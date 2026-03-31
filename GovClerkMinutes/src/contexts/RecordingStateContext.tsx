import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
  ReactNode,
} from "react";
import { useRouter } from "next/router";
import posthog from "posthog-js";
import useRecordingSession from "@/hooks/useRecordingSession";
import {
  RECORDING_CONSTANTS,
  createBlobFromChunkRange,
  getCurrentChunkCount,
} from "@/common/indexeddb";
import { safeCapture } from "@/utils/safePosthog";
import { isDev } from "@/utils/dev";
import { ApiCreateSessionResponse } from "@/pages/api/recorder/upload/create-session";

const RECORDING_FAILURE_MESSAGE =
  "Your recording was interrupted due to a technical issue. Please try recording again.";

// How long to wait (ms) after requestData() so that the async ondataavailable
// event can fire on Android Chrome before tearDownRecorder() stops the tracks.
const REQUEST_DATA_SETTLE_DELAY_MS = 500;

// Retry settings for the final-chunk S3 upload in stopRecording.
const MAX_UPLOAD_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 500;

export type RecordingState =
  | "idle"
  | "requesting-permission"
  | "recording"
  | "paused"
  | "stopped"
  | "processing"
  | "permission-denied";

type RecordingStateContextType = {
  recordingState: RecordingState;
  sessionId: string | null;
  setSessionId: (id: string | null) => void;
  duration: number;
  startRecording: (transcriptId: number) => Promise<void>;
  stopRecording: () => Promise<void>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  isSupported: boolean;
  isClient: boolean;
  error: string | null;
  setError(error: string | null): void;
  totalFileSize: number;
};

const RecordingStateContext = createContext<RecordingStateContextType | undefined>(undefined);

export function RecordingStateProvider({ children }: { children: ReactNode }) {
  const router = useRouter();

  //  React & runtime state (used in UI, triggers re-renders)
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [isClient, setIsClient] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalFileSize, setTotalFileSize] = useState(0);

  // MediaRecorder-related refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Duration Tracking
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentSessionStartRef = useRef<number>(0);
  const accumulatedDurationRef = useRef<number>(0);

  // Session-related refs (metadata or control)
  const currentTranscriptIdRef = useRef<number | null>(null);
  const autoStartedRef = useRef<boolean>(false);

  // Upload state tracking (accumulated data & chunk indexing)
  const partsUploadedRef = useRef(0);
  const lastUploadedChunkRef = useRef(0);
  const accumulatedSizeRef = useRef(0);

  // File state tracking (non-reactive)
  const totalFileSizeRef = useRef(0);

  const {
    currentSessionId,
    createSession,
    saveChunk,
    updateDuration: updateSessionDuration,
    updateState: updateSessionState,
  } = useRecordingSession();

  // Set client-side flag after hydration
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Check if MediaRecorder is supported (only on client)
  const isSupported =
    isClient && "MediaRecorder" in window && "navigator" in window && "mediaDevices" in navigator;

  const startDurationTimer = useCallback(() => {
    currentSessionStartRef.current = Date.now();
    durationIntervalRef.current = setInterval(() => {
      if (currentSessionStartRef.current > 0) {
        const currentSessionDuration = Math.floor(
          (Date.now() - currentSessionStartRef.current) / 1000
        );
        setDuration(accumulatedDurationRef.current + currentSessionDuration);
      }
    }, 1000);
  }, []);

  const stopDurationTimer = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
  }, []);

  const tearDownRecorder = useCallback(
    (resetState: boolean = false) => {
      stopDurationTimer();

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      mediaRecorderRef.current = null;

      if (resetState) {
        setRecordingState("idle");
        setSessionId(null);
        autoStartedRef.current = false;
        setError(null);
      }
    },
    [stopDurationTimer]
  );

  // Helper function for S3 upload logic
  const uploadChunkToS3 = useCallback(
    async (sessionId: string, blob: Blob, partNumber: number): Promise<boolean> => {
      try {
        // Step 1: Get presigned URL
        const presignedResponse = await fetch("/api/recorder/upload/get-presigned-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: sessionId,
            partNumber: partNumber,
          }),
        });

        if (!presignedResponse.ok) {
          throw new Error(`Failed to get presigned URL: ${presignedResponse.statusText}`);
        }

        const { presignedUrl } = await presignedResponse.json();

        // Step 2: Upload to S3
        const response = await fetch(presignedUrl, {
          method: "PUT",
          body: blob,
          headers: {
            "Content-Type": "audio/webm",
          },
        });

        if (!response.ok) {
          safeCapture("recording_error", {
            error_type: "chunk_upload_failed",
            session_id: sessionId,
            status: response.status,
            status_text: response.statusText,
            chunk_size: blob.size,
          });
          return false;
        }

        // Step 3: Update part ETag
        const eTag = response.headers.get("etag");
        if (eTag) {
          try {
            await fetch("/api/recorder/upload/set-etag", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                sessionId: sessionId,
                partNumber: partNumber,
                eTag: eTag,
                chunkSize: blob.size,
              }),
            });
          } catch (error) {
            console.warn("Failed to update part ETag:", error);
          }
        }

        return true;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        safeCapture("recording_error", {
          error_type: "chunk_upload_error",
          session_id: sessionId,
          error_message: errorMessage,
          accumulated_size: accumulatedSizeRef.current,
        });
        return false;
      }
    },
    []
  );

  const requestMicrophoneAccess = useCallback(async (): Promise<MediaStream | null> => {
    if (!isSupported) {
      return null;
    }
    try {
      setRecordingState("requesting-permission");

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });

      return stream;
    } catch (err) {
      // Check if it's a permission denied error
      if (err instanceof DOMException) {
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          setRecordingState("permission-denied");
          safeCapture("recording_permission_denied", {
            error_name: err.name,
            error_message: err.message,
            browser_supported: isSupported,
          });
          return null;
        }
      }

      safeCapture("recording_error", {
        error_type: "permission_request_failed",
        error_name: err instanceof Error ? err.name : "Unknown",
        error_message: err instanceof Error ? err.message : String(err),
        browser_supported: isSupported,
      });

      setRecordingState("idle");
      return null;
    }
  }, [isSupported]);

  const startRecording = useCallback(
    async (transcriptId: number) => {
      if (autoStartedRef.current && currentTranscriptIdRef.current === transcriptId) {
        return; // Already recording this transcript
      }

      setDuration(0);
      accumulatedDurationRef.current = 0;
      currentSessionStartRef.current = 0;
      lastUploadedChunkRef.current = 0;
      accumulatedSizeRef.current = 0;
      totalFileSizeRef.current = 0;
      setTotalFileSize(0);
      partsUploadedRef.current = 0;
      autoStartedRef.current = true;

      currentTranscriptIdRef.current = transcriptId;

      try {
        const region = "us-east-1";

        const response = await fetch("/api/recorder/upload/create-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcriptId, region }),
        });

        if (!response.ok) {
          tearDownRecorder();
          setError("A recording error occured for this transcript.");
          return;
        }

        const sessionResult: ApiCreateSessionResponse = await response.json();
        const newSessionId = sessionResult.sessionId;
        setSessionId(newSessionId);

        // Handle forcing user to create new transcript for expired sessions
        if (sessionResult.isExisting && sessionResult.recordingState !== "recording") {
          tearDownRecorder();

          if (sessionResult.recordingState === "expired") {
            setError(
              "This recording session has expired. You must create a new transcript to record."
            );
          }
          return;
        }

        const stream = await requestMicrophoneAccess();
        if (!stream) {
          return;
        }

        streamRef.current = stream;

        // Clear any previous errors since we're successfully starting recording
        setError(null);

        // Create MediaRecorder while trying best quality first
        const mediaRecorderOptions: MediaRecorderOptions = {};
        const supportedFormats = [
          "audio/webm;codecs=opus",
          "audio/webm;codecs=vorbis",
          "audio/webm",
        ];

        for (const format of supportedFormats) {
          if (MediaRecorder.isTypeSupported(format)) {
            mediaRecorderOptions.mimeType = format;
            break;
          }
        }

        const mediaRecorder = new MediaRecorder(stream, mediaRecorderOptions);
        mediaRecorderRef.current = mediaRecorder;

        await createSession(
          mediaRecorderOptions.mimeType || "audio/webm",
          mediaRecorderOptions,
          newSessionId
        );

        mediaRecorder.ondataavailable = async (event) => {
          if (event.data.size > 0 && newSessionId) {
            try {
              await saveChunk(newSessionId, event.data);

              accumulatedSizeRef.current += event.data.size;

              totalFileSizeRef.current += event.data.size;
              setTotalFileSize(totalFileSizeRef.current);

              // Check if we've accumulated 10MB+ and should upload
              const TEN_MB = 10 * 1024 * 1024;
              if (newSessionId && accumulatedSizeRef.current >= TEN_MB) {
                accumulatedSizeRef.current = 0;

                try {
                  // Get current chunk count and upload only new chunks since last upload
                  const currentChunkCount = await getCurrentChunkCount(newSessionId);
                  const startChunkIndex = lastUploadedChunkRef.current;
                  const endChunkIndex = currentChunkCount - 1;

                  if (endChunkIndex >= startChunkIndex) {
                    const blob = await createBlobFromChunkRange(
                      newSessionId,
                      startChunkIndex,
                      endChunkIndex
                    );
                    if (blob && blob.size > 0) {
                      const partNumber = partsUploadedRef.current + 1;
                      const uploadSuccess = await uploadChunkToS3(newSessionId, blob, partNumber);

                      if (uploadSuccess) {
                        // Update the last uploaded chunk index to prevent re-uploading
                        lastUploadedChunkRef.current = endChunkIndex + 1;
                        partsUploadedRef.current++;
                      }
                    }
                  }
                } catch (error) {
                  const errorMessage = error instanceof Error ? error.message : String(error);

                  safeCapture("recording_error", {
                    error_type: "chunk_upload_error",
                    session_id: newSessionId,
                    error_message: errorMessage,
                    accumulated_size: accumulatedSizeRef.current,
                  });
                }
              }
            } catch (error) {
              const technicalError = error instanceof Error ? error.message : String(error);

              setError(RECORDING_FAILURE_MESSAGE);

              await updateSessionState(newSessionId, "recovered");

              safeCapture("recording_error", {
                error_type: "session_corruption_detected",
                session_id: newSessionId,
                error_message: technicalError,
                duration_seconds: accumulatedDurationRef.current,
              });

              setRecordingState("idle");
              tearDownRecorder();
            }
          }
        };

        mediaRecorder.onerror = () => {
          if (newSessionId) {
            updateSessionState(newSessionId, "recovered");
          }

          safeCapture("recording_error", {
            error_type: "media_recorder_error",
            session_id: newSessionId,
            duration_seconds: accumulatedDurationRef.current,
            recording_state: recordingState,
          });

          setRecordingState("idle");
          tearDownRecorder();
        };

        // Start recording with 5 second chunks
        mediaRecorder.start(RECORDING_CONSTANTS.CHUNK_DURATION_MS);
        setRecordingState("recording");
        startDurationTimer();

        safeCapture("recording_started", {
          mime_type: mediaRecorderOptions.mimeType || "audio/webm",
          session_id: newSessionId,
          chunk_duration: RECORDING_CONSTANTS.CHUNK_DURATION_MS,
          browser_supported: isSupported,
        });
      } catch (err) {
        safeCapture("recording_error", {
          error_type: "start_recording_failed",
          error_name: err instanceof Error ? err.name : "Unknown",
          error_message: err instanceof Error ? err.message : String(err),
          browser_supported: isSupported,
        });

        throw new Error("Failed to start recording");
      }
    },
    [
      requestMicrophoneAccess,
      tearDownRecorder,
      startDurationTimer,
      saveChunk,
      updateSessionState,
      recordingState,
      isSupported,
      uploadChunkToS3,
      createSession,
      setError,
    ]
  );

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && recordingState === "recording") {
      if (currentSessionStartRef.current > 0) {
        const currentSessionDuration = Math.floor(
          (Date.now() - currentSessionStartRef.current) / 1000
        );
        accumulatedDurationRef.current += currentSessionDuration;
        setDuration(accumulatedDurationRef.current);

        if (currentSessionId) {
          updateSessionDuration(currentSessionId, accumulatedDurationRef.current);
          updateSessionState(currentSessionId, "paused");
        }
      }
      mediaRecorderRef.current.pause();
      setRecordingState("paused");
      stopDurationTimer();
      currentSessionStartRef.current = 0;

      safeCapture("recording_paused", {
        duration_seconds: accumulatedDurationRef.current,
        session_id: currentSessionId,
      });
    }
  }, [
    recordingState,
    stopDurationTimer,
    currentSessionId,
    updateSessionDuration,
    updateSessionState,
  ]);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && recordingState === "paused") {
      mediaRecorderRef.current.resume();
      setRecordingState("recording");
      startDurationTimer();
      if (currentSessionId) {
        updateSessionState(currentSessionId, "recording");
      }

      safeCapture("recording_resumed", {
        duration_seconds: accumulatedDurationRef.current,
        session_id: currentSessionId,
      });
    }
  }, [recordingState, startDurationTimer, currentSessionId, updateSessionState]);

  const stopRecording = useCallback(async () => {
    if (
      mediaRecorderRef.current &&
      (recordingState === "recording" || recordingState === "paused")
    ) {
      let finalDuration = accumulatedDurationRef.current;
      if (recordingState === "recording" && currentSessionStartRef.current > 0) {
        const currentSessionDuration = Math.floor(
          (Date.now() - currentSessionStartRef.current) / 1000
        );
        finalDuration = accumulatedDurationRef.current + currentSessionDuration;
        setDuration(finalDuration);
      }

      // Request any remaining data before stopping to ensure we have all captured chunks.
      // On Android Chrome, requestData() triggers an async ondataavailable event; we
      // wait 500 ms so that event can fire before tearDownRecorder() stops the tracks.
      if (mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.requestData();
        await new Promise<void>((resolve) => setTimeout(resolve, REQUEST_DATA_SETTLE_DELAY_MS));
      }

      if (currentSessionId) {
        await updateSessionState(currentSessionId, "completed");
        await updateSessionDuration(currentSessionId, finalDuration);
      }

      tearDownRecorder();

      setRecordingState("processing");

      stopDurationTimer();
      currentSessionStartRef.current = 0;

      safeCapture("recording_stopped", {
        duration_seconds: accumulatedDurationRef.current,
        session_id: currentSessionId,
        previous_state: recordingState,
      });

      const transcriptId = currentTranscriptIdRef.current;

      if (isDev() && transcriptId) {
        const region = "us-east-1";
        fetch("/api/dev-only-poll-for-upload-complete", {
          method: "POST",
          body: JSON.stringify({
            transcriptId,
            region,
          }),
        }).catch((error) => {
          console.warn("Failed to start dev-only polling:", error);
        });
      }

      if (currentSessionId) {
        try {
          // Upload any remaining chunks that haven't been uploaded yet
          const currentChunkCount = await getCurrentChunkCount(currentSessionId);
          const startChunkIndex = lastUploadedChunkRef.current;
          const endChunkIndex = currentChunkCount - 1;

          if (endChunkIndex >= startChunkIndex) {
            const blob = await createBlobFromChunkRange(
              currentSessionId,
              startChunkIndex,
              endChunkIndex
            );
            if (blob && blob.size > 0) {
              const partNumber = partsUploadedRef.current + 1;

              // Retry the final chunk upload up to MAX_UPLOAD_RETRIES times with
              // exponential backoff to survive transient network interruptions on mobile.
              let uploadSuccess = false;
              for (let attempt = 0; attempt < MAX_UPLOAD_RETRIES && !uploadSuccess; attempt++) {
                if (attempt > 0) {
                  await new Promise<void>((resolve) =>
                    setTimeout(resolve, Math.pow(2, attempt) * BASE_RETRY_DELAY_MS)
                  );
                }
                uploadSuccess = await uploadChunkToS3(currentSessionId, blob, partNumber);
              }

              if (!uploadSuccess) {
                throw new Error("Failed to upload final chunk");
              }
            }
          }

          // Mark upload as complete. Use keepalive so the request survives
          // tab suspension on mobile.
          const completeResponse = await fetch("/api/recorder/complete-upload", {
            method: "POST",
            keepalive: true,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionId: currentSessionId,
            }),
          });

          if (!completeResponse.ok) {
            throw new Error(`Failed to complete upload: ${completeResponse.statusText}`);
          }
        } catch {
          // set error
          setError(
            "We weren't able to complete your upload but your recording is still available locally. Please upload it directly."
          );
        }
      }
    }
  }, [
    recordingState,
    stopDurationTimer,
    currentSessionId,
    updateSessionDuration,
    updateSessionState,
    tearDownRecorder,
    uploadChunkToS3,
  ]);

  // Cleanup on component unmount or when recording should be stopped
  useEffect(() => {
    return () => {
      tearDownRecorder(true); // Reset state on unmount
    };
  }, [tearDownRecorder]);

  // Handle navigation events, ensure recorder is cleaned on every render
  useEffect(() => {
    const handleRouteChangeStart = () => {
      tearDownRecorder(true);
    };

    router.events.on("routeChangeStart", handleRouteChangeStart);

    return () => {
      router.events.off("routeChangeStart", handleRouteChangeStart);
    };
  }, [router.events, tearDownRecorder, recordingState]);

  return (
    <RecordingStateContext.Provider
      value={{
        recordingState,
        sessionId,
        setSessionId,
        duration,
        startRecording,
        stopRecording,
        pauseRecording,
        resumeRecording,
        isSupported,
        isClient,
        error,
        setError,
        totalFileSize,
      }}
    >
      {children}
    </RecordingStateContext.Provider>
  );
}

export function useRecordingState() {
  const context = useContext(RecordingStateContext);
  if (context === undefined) {
    throw new Error("useRecordingState must be used within a RecordingStateProvider");
  }
  return context;
}
