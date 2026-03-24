import { useState, useEffect, useCallback } from "react";
import {
  RecordingSessionMetadata,
  getRecordingSessionMetadata,
  deleteRecordingSession,
  detectAndMarkAllRecoveredSessions,
} from "@/common/indexeddb";
import { compileRecordingToBlob, generateRecordingFilename, downloadBlob } from "@/utils/recording";
import { safeCapture } from "@/utils/safePosthog";

export type RecordingWithBlob = RecordingSessionMetadata & {
  blob: Blob | null;
  isCompiling: boolean;
  error: string | null;
};

export type UseRecordingsResult = {
  recordings: RecordingWithBlob[];
  isLoading: boolean;
  error: string | null;
  refreshRecordings: () => Promise<void>;
  downloadRecording: (sessionId: string, filename?: string) => void;
  deleteRecording: (sessionId: string) => Promise<void>;
  getTotalSize: () => number;
};

export default function useRecordings(): UseRecordingsResult {
  const [recordings, setRecordings] = useState<RecordingWithBlob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const compileRecordingBlob = useCallback(
    async (session: RecordingSessionMetadata): Promise<Blob | null> => {
      return await compileRecordingToBlob(session.sessionId);
    },
    []
  );

  const loadRecordings = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const recoveredSessions = await detectAndMarkAllRecoveredSessions();

      recoveredSessions.forEach((session) => {
        safeCapture("recording_recovered", {
          session_id: session.sessionId,
          previous_state: session.state === "recovered" ? "recording" : session.state,
          duration_seconds: session.accumulatedDuration,
          chunk_count: session.chunkCount || 0,
          mime_type: session.mimeType,
        });
      });

      const sessions = await getRecordingSessionMetadata();

      const sortedSessions = sessions.sort((a, b) => b.startTime - a.startTime);

      const recordingsWithBlobs: RecordingWithBlob[] = sortedSessions.map((session) => ({
        ...session,
        blob: null,
        isCompiling: true,
        error: null,
      }));

      setRecordings(recordingsWithBlobs);

      // Compile blobs for each recording
      for (let i = 0; i < sortedSessions.length; i++) {
        const session = sortedSessions[i];
        try {
          const blob = await compileRecordingBlob(session);

          setRecordings((prev) =>
            prev.map((recording, index) =>
              index === i ? { ...recording, blob, isCompiling: false, error: null } : recording
            )
          );
        } catch (error) {
          console.error(`Error compiling recording ${session.sessionId}:`, error);
          safeCapture("recording_compile_error", {
            session_id: session.sessionId,
            error: error instanceof Error ? error.message : String(error),
          });
          setRecordings((prev) =>
            prev.map((recording, index) =>
              index === i
                ? { ...recording, blob: null, isCompiling: false, error: "Failed to compile audio" }
                : recording
            )
          );
        }
      }
    } catch (error) {
      console.error("Error loading recordings:", error);
      setError("Failed to load recordings");
    } finally {
      setIsLoading(false);
    }
  }, [compileRecordingBlob]);

  const downloadRecording = useCallback(
    (sessionId: string, filename?: string) => {
      const recording = recordings.find((r) => r.sessionId === sessionId);
      if (!recording || !recording.blob) {
        console.error("Recording or blob not found for download");
        return;
      }

      const finalFilename = filename || generateRecordingFilename(recording);
      downloadBlob(recording.blob, finalFilename);
    },
    [recordings]
  );

  const deleteRecording = useCallback(async (sessionId: string) => {
    try {
      await deleteRecordingSession(sessionId);
      setRecordings((prev) => prev.filter((recording) => recording.sessionId !== sessionId));
    } catch (error) {
      console.error("Error deleting recording:", error);
      throw error;
    }
  }, []);

  const getTotalSize = useCallback(() => {
    return recordings.reduce((total, recording) => {
      if (recording.blob) {
        return total + recording.blob.size;
      }
      return total;
    }, 0);
  }, [recordings]);

  const refreshRecordings = useCallback(async () => {
    await loadRecordings();
  }, [loadRecordings]);

  useEffect(() => {
    loadRecordings();
  }, [loadRecordings]);

  return {
    recordings,
    isLoading,
    error,
    refreshRecordings,
    downloadRecording,
    deleteRecording,
    getTotalSize,
  };
}
