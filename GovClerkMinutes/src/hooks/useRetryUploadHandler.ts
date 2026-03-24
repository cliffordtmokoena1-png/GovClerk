import { useCallback } from "react";
import { ApiS3ResponseResult } from "@/pages/api/s3";
import posthog from "posthog-js";
import { ApiTranscriptStatusResponseResult } from "@/pages/api/transcript-status";
import {
  storeUploadedFile,
  getFileFromStorage,
  getTranscriptRecordFromStorage,
} from "@/common/indexeddb";
import { uploadWithAdaptiveConcurrency, DEFAULT_OPTIONS } from "@/common/adaptiveConcurrency";
import { safeCapture } from "@/utils/safePosthog";

type UseRetryUploadHandlerParams = {
  transcriptStatus: ApiTranscriptStatusResponseResult | undefined;
  mutateTranscriptStatus: (data: ApiTranscriptStatusResponseResult, revalidate: boolean) => void;
};

/**
 * Hook for handling retrying failed uploads from IndexedDB
 */
export default function useRetryUploadHandler({
  transcriptStatus,
  mutateTranscriptStatus,
}: UseRetryUploadHandlerParams) {
  const handleRetryUpload = useCallback(
    async (tid: number) => {
      if (!tid) {
        return;
      }

      if (transcriptStatus) {
        mutateTranscriptStatus(
          {
            ...transcriptStatus,
            uploadComplete: false,
          },
          false // Don't revalidate with the server immediately
        );
      }

      try {
        // Get file from IndexedDB
        const file = await getFileFromStorage(tid);
        const transcript = await getTranscriptRecordFromStorage(tid);

        if (!file || !transcript) {
          throw new Error("File or transcript not found in IndexedDB");
        }

        const region = "us-east-2";
        const useBiggerPartSize = posthog.isFeatureEnabled("bigger-multipart");

        const s3Result: ApiS3ResponseResult = await fetch("/api/s3", {
          method: "POST",
          body: JSON.stringify({
            transcriptId: tid,
            prompt: "",
            fileSize: file.size,
            useBiggerPartSize,
            region,
          }),
        }).then((r) => r.json());

        safeCapture("retry_upload_started", {
          transcript_id: tid,
          s3_result: s3Result,
          region,
        });

        await storeUploadedFile(tid, file, s3Result.uploadId, s3Result.presignedUrls, false);

        const uploadStart = Date.now();
        await uploadWithAdaptiveConcurrency(
          tid,
          s3Result.presignedUrls,
          {
            ...DEFAULT_OPTIONS,
            initialConcurrency: 2,
            increaseRate: 2,
          },
          {
            onFetchStarting: async (transcriptId, partNumber, uploadId) => {
              safeCapture("retry_fetch_starting", {
                transcriptId,
                partNumber,
                uploadId,
                region,
              });
            },
            onFetchFinished: async (transcriptId, partNumber, durationSecs, response) => {
              safeCapture("retry_fetch_finished", {
                transcriptId,
                partNumber,
                durationSecs,
                response,
                region,
              });
            },
            onFetchFullyFinished: async (transcriptId, response) => {
              safeCapture("retry_fetch_fully_finished", {
                transcriptId,
                response,
                duration: Date.now() - uploadStart,
                isAdaptive: true,
                region,
              });
            },
            onFetchRetry: async (properties) => {
              safeCapture("retry_fetch_retry", properties);
            },
            onFetchChunkUpload: (properties) => {
              safeCapture("retry_fetch_chunk_upload", properties);
            },
          }
        );
      } catch (err) {
        console.error("Error retrying upload:", err);
        safeCapture("retry_upload_error", {
          transcript_id: tid,
          error: err instanceof Error ? err.stack : String(err),
        });
        throw err;
      }
    },
    [transcriptStatus, mutateTranscriptStatus]
  );

  return handleRetryUpload;
}
