import { useState, useCallback } from "react";
import {
  RecordingSessionMetadata,
  RecordingSessionState,
  RECORDING_CONSTANTS,
  createRecordingSession,
  saveSessionChunk,
  updateSessionDuration,
  updateSessionState,
  getRecordingSessionMetadata,
  deleteRecordingSession,
  completeSession,
} from "@/common/indexeddb";
import { safeCapture } from "@/utils/safePosthog";

export type UseRecordingSessionResult = {
  currentSessionId: string | null;
  createSession: (
    mimeType: string,
    recordingOptions: MediaRecorderOptions,
    sessionId: string
  ) => Promise<string>;
  saveChunk: (sessionId: string, chunk: Blob) => Promise<void>;
  updateDuration: (sessionId: string, duration: number) => Promise<void>;
  updateState: (sessionId: string, state: RecordingSessionState) => Promise<void>;
  getSession: (sessionId: string) => Promise<RecordingSessionMetadata | undefined>;
  deleteSession: (sessionId: string) => Promise<void>;
  completeSession: (sessionId: string, finalDuration?: number) => Promise<Blob | null>;
  isSessionActive: boolean;
};

export default function useRecordingSession(): UseRecordingSessionResult {
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isSessionActive, setIsSessionActive] = useState(false);

  const createSession = useCallback(
    async (
      mimeType: string,
      recordingOptions: MediaRecorderOptions,
      providedSessionId: string
    ): Promise<string> => {
      const sessionId = providedSessionId;
      const now = Date.now();

      const metadata: RecordingSessionMetadata = {
        sessionId,
        startTime: now,
        lastChunkTime: now,
        accumulatedDuration: 0,
        state: "recording",
        mimeType,
        recordingOptions,
        chunkDuration: RECORDING_CONSTANTS.CHUNK_DURATION_MS,
        chunkCount: 0,
      };

      await createRecordingSession(metadata);
      setCurrentSessionId(sessionId);
      setIsSessionActive(true);

      return sessionId;
    },
    []
  );

  const saveChunk = useCallback(async (sessionId: string, chunk: Blob): Promise<void> => {
    try {
      await saveSessionChunk(sessionId, chunk);
    } catch (error) {
      throw error;
    }
  }, []);

  const updateDuration = useCallback(async (sessionId: string, duration: number): Promise<void> => {
    try {
      await updateSessionDuration(sessionId, duration);
    } catch (error) {
      throw error;
    }
  }, []);

  const updateState = useCallback(
    async (sessionId: string, state: RecordingSessionState): Promise<void> => {
      try {
        await updateSessionState(sessionId, state);

        // Update local state based on session state
        if (state === "completed" || state === "recovered") {
          setIsSessionActive(false);
          if (currentSessionId === sessionId) {
            setCurrentSessionId(null);
          }
        } else if (state === "recording" || state === "paused") {
          setIsSessionActive(true);
        }
      } catch (error) {
        safeCapture("recording_error", {
          error_type: "state_update_failed",
          session_id: sessionId,
          target_state: state,
          error_message: error instanceof Error ? error.message : String(error),
        });
      }
    },
    [currentSessionId]
  );

  const getSession = useCallback(
    async (sessionId: string): Promise<RecordingSessionMetadata | undefined> => {
      try {
        return await getRecordingSessionMetadata(sessionId);
      } catch {
        return undefined;
      }
    },
    []
  );

  const deleteSession = useCallback(
    async (sessionId: string): Promise<void> => {
      try {
        await deleteRecordingSession(sessionId);
        if (currentSessionId === sessionId) {
          setCurrentSessionId(null);
          setIsSessionActive(false);
        }
      } catch (error) {
        safeCapture("recording_error", {
          error_type: "session_delete_failed",
          session_id: sessionId,
          error_message: error instanceof Error ? error.message : String(error),
        });
      }
    },
    [currentSessionId]
  );

  const completeSessionCallback = useCallback(
    async (sessionId: string, finalDuration?: number): Promise<Blob | null> => {
      try {
        const finalBlob = await completeSession(sessionId, finalDuration);

        // Update local state
        setIsSessionActive(false);
        if (currentSessionId === sessionId) {
          setCurrentSessionId(null);
        }

        return finalBlob;
      } catch {
        return null;
      }
    },
    [currentSessionId]
  );

  return {
    currentSessionId,
    createSession,
    saveChunk,
    updateDuration,
    updateState,
    getSession,
    deleteSession,
    completeSession: completeSessionCallback,
    isSessionActive,
  };
}
