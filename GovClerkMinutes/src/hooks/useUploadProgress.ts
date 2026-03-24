import {
  getUploadPartsForTranscript,
  getRecordingSessionMetadata,
  RecordingSessionMetadata,
} from "@/common/indexeddb";
import { useEffect, useState } from "react";
import { safeCapture } from "@/utils/safePosthog";

type UseUploadProgress = {
  chunksUploaded: number;
  totalChunks: number;
  uploadProgressError?: string;
};

async function getUploadProgress(transcriptId: number): Promise<UseUploadProgress> {
  // First check for regular file upload parts
  const parts = await getUploadPartsForTranscript(transcriptId);

  if (parts != null) {
    return {
      chunksUploaded: parts.filter((part) => part.eTag != null).length,
      totalChunks: parts.length,
    };
  }

  try {
    const recordingSessions = await getRecordingSessionMetadata();
    const recordingSession = recordingSessions.find((session: RecordingSessionMetadata) => {
      // Always assume that the current ID is the one we care about.
      return session.state === "recording" || session.state === "paused";
    });

    if (recordingSession) {
      return {
        chunksUploaded: recordingSession.chunkCount,
        totalChunks: Math.max(1, recordingSession.chunkCount + 1), // Always show some progress
      };
    }
  } catch (error) {
    console.warn("Unable to render upload progress", error);
  }

  return {
    chunksUploaded: 0,
    totalChunks: 1,
    uploadProgressError: `Transcript not found ${transcriptId}`,
  };
}

export default function useUploadProgress(transcriptId: number | undefined): UseUploadProgress {
  const [uploadProgress, setUploadProgress] = useState<UseUploadProgress>({
    chunksUploaded: 0,
    totalChunks: 1,
  });

  useEffect(() => {
    const interval = setInterval(() => {
      if (transcriptId == null || uploadProgress.chunksUploaded === uploadProgress.totalChunks) {
        clearInterval(interval);
        return;
      }
      getUploadProgress(transcriptId).then(setUploadProgress);
    }, 1000);

    return () => clearInterval(interval);
  }, [transcriptId, uploadProgress.chunksUploaded, uploadProgress.totalChunks]);

  return uploadProgress;
}
