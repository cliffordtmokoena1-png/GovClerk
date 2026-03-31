import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/router";
import posthog from "posthog-js";
import { useContext } from "react";
import { UploadUriContext } from "@/components/UploadUriProvider";
import { ApiS3ResponseResult } from "@/pages/api/s3";
import { ApiCreateIdResponse } from "@/pages/api/create-id";
import { getTimer } from "@/utils/timer";
import { safeCapture } from "@/utils/safePosthog";
import { isDev } from "@/utils/dev";
import { storeUploadedFile } from "@/common/indexeddb";
import { uploadWithAdaptiveConcurrency, DEFAULT_OPTIONS } from "@/common/adaptiveConcurrency";
import { zipFiles } from "@/utils/zip";
import { getUploadKind } from "@/uploadKind/uploadKind";
import { useOrgContext } from "@/contexts/OrgContext";

type UseFileUploadHandlerParams = {
  prompt?: string;
  impersonatedUserId?: string; // Admin only
  onUploadComplete?: (transcriptId: number, fileName: string) => void; // Admin only callback
};

type FileUploadHandlerResult = {
  onDrop: (acceptedFiles: File[]) => Promise<void>;
  isTransitioning: boolean;
  showWarningModal: boolean;
  onWarningAccepted: () => void;
};

/**
 * Hook to handle file uploads for transcription
 * Encapsulates the file drop handling, S3 upload, and analytics
 */
export default function useFileUploadHandler({
  prompt = "",
  impersonatedUserId,
  onUploadComplete,
}: UseFileUploadHandlerParams): FileUploadHandlerResult {
  const router = useRouter();
  const { updateUploadUri } = useContext(UploadUriContext);
  const { orgId } = useOrgContext();
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
  const [showWarningModal, setShowWarningModal] = useState<boolean>(false);
  const pendingFilesRef = useRef<File[] | null>(null);

  const executeUpload = useCallback(
    async (acceptedFiles: File[]) => {
      try {
        const timer = getTimer({ clearTimer: true });
        timer.start("on_drop");

        if (acceptedFiles.length === 0) {
          return;
        }

        const isMultiple = acceptedFiles.length > 1;
        const firstFile = acceptedFiles[0];
        let fileSize = firstFile.size;

        const title = acceptedFiles.map((file) => file.name).join("_");
        const uploadKind = getUploadKind(firstFile.name);
        if (!acceptedFiles.every((file) => getUploadKind(file.name) === uploadKind)) {
          throw new Error("All files must have the same upload kind.");
        } else if (uploadKind !== "image" && isMultiple) {
          throw new Error("We only support uploading multiple image files.");
        }

        setIsTransitioning(true);

        const region = "us-east-1";

        // Create a new transcript ID on the server
        const createIdUrl = impersonatedUserId ? "/api/admin/create-id" : "/api/create-id";
        const requestBody = impersonatedUserId
          ? { userId: impersonatedUserId, title, uploadKind, fileSize, region }
          : { title, uploadKind, fileSize, region, orgId };

        const createIdResponse: ApiCreateIdResponse = await fetch(createIdUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        }).then((r) => r.json());

        let uploadedFile = firstFile;
        if (isMultiple) {
          uploadedFile = await zipFiles(acceptedFiles, {
            outputName: title,
          });
        }
        fileSize = uploadedFile.size;
        const uri = URL.createObjectURL(uploadedFile);

        safeCapture("transcribe_started_browser", {
          transcript_id: createIdResponse.transcriptId,
          title,
          file_size: fileSize,
          upload_kind: uploadKind,
          region,
        });

        // For admin uploads, we won't navigate away
        if (!impersonatedUserId) {
          await router.push(`/dashboard/${createIdResponse.transcriptId}`, undefined);

          updateUploadUri(createIdResponse.transcriptId, {
            uri,
            kind: uploadKind,
            filename: title,
          });
        }

        // Request presigned URLs
        const useBiggerPartSize = posthog.isFeatureEnabled("bigger-multipart");
        const s3Url = impersonatedUserId ? "/api/admin/s3" : "/api/s3";
        const s3Result: ApiS3ResponseResult = await fetch(s3Url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transcriptId: createIdResponse.transcriptId,
            prompt,
            fileSize,
            useBiggerPartSize,
            region,
          }),
        }).then((r) => r.json());

        safeCapture("s3_upload_started_browser", {
          transcript_id: createIdResponse.transcriptId,
          s3_result: s3Result,
          region,
        });

        try {
          await storeUploadedFile(
            createIdResponse.transcriptId,
            uploadedFile,
            s3Result.uploadId,
            s3Result.presignedUrls,
            !!impersonatedUserId
          );
          safeCapture("indexeddb_success", {
            transcript_id: createIdResponse.transcriptId,
          });
        } catch (err) {
          safeCapture("indexeddb_error", {
            transcript_id: createIdResponse.transcriptId,
            error: err instanceof Error ? err.stack : err,
          });
        }

        timer.start("on_drop_upload");

        const uploadStart = Date.now();
        // Track whether the ETag-based completion path fired successfully.
        // When browser CORS blocks S3 PUT response ETag headers, the internal
        // allUploadPartsComplete check never passes, and onFetchFullyFinished
        // is never called. The .then() below acts as a fallback in that case.
        let uploadFullyFinished = false;
        uploadWithAdaptiveConcurrency(
          createIdResponse.transcriptId,
          s3Result.presignedUrls,
          {
            ...DEFAULT_OPTIONS,
            initialConcurrency: 2,
            increaseRate: 2,
          },
          {
            onFetchStarting: async (transcriptId, partNumber, uploadId) => {
              safeCapture("fg_fetch_starting", {
                transcriptId,
                partNumber,
                uploadId,
                region,
              });
            },
            onFetchFinished: async (transcriptId, partNumber, durationSecs, response) => {
              safeCapture("fg_fetch_finished", {
                transcriptId,
                partNumber,
                durationSecs,
                response,
                region,
              });
            },
            onFetchFullyFinished: async (transcriptId, response) => {
              uploadFullyFinished = true;
              safeCapture("fg_fetch_fully_finished", {
                transcriptId,
                response,
                duration: Date.now() - uploadStart,
                isAdaptive: true,
                region,
              });

              safeCapture("upload_finished", {
                transcript_id: transcriptId,
                kind: "fg_upload_ac",
                duration: timer.stop("on_drop_upload"),
                fileSize,
                region,
              });

              // Template selection is now handled via settings, not per-upload
              // The backend will fetch the selected template from gc_templating table

              setIsTransitioning(false);

              if (impersonatedUserId && onUploadComplete) {
                onUploadComplete(transcriptId, title);
              }
            },
            onFetchRetry: async (properties) => {
              safeCapture("fg_fetch_retry", properties);
            },
            onFetchChunkUpload: (properties) => {
              safeCapture("fg_fetch_chunk_upload", properties);
            },
          }
        )
          .then(async () => {
            // Fallback: all parts were uploaded to S3 but the ETag-based completion
            // path inside uploadPartOfMultipartUpload never triggered (because CORS
            // blocked the ETag header on the presigned-URL PUT responses). Call
            // complete-upload now without parts so the server can use
            // ListPartsCommand to retrieve ETags and finalize the multipart upload.
            //
            // When the normal path ran successfully, onFetchFullyFinished set
            // uploadFullyFinished = true AND called setIsTransitioning(false) before
            // uploadWithAdaptiveConcurrency resolved. In that case this block is
            // skipped entirely — no duplicate state update or API call is made.
            if (!uploadFullyFinished) {
              try {
                const completeUrl = impersonatedUserId
                  ? "/api/admin/complete-upload"
                  : "/api/complete-upload";
                const r = await fetch(completeUrl, {
                  method: "POST",
                  keepalive: true,
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    transcriptId: createIdResponse.transcriptId,
                    uploadId: s3Result.uploadId,
                    // No parts supplied — server fetches them via ListPartsCommand.
                  }),
                });
                if (r.ok) {
                  setIsTransitioning(false);
                  if (impersonatedUserId && onUploadComplete) {
                    onUploadComplete(createIdResponse.transcriptId, title);
                  }
                }
              } catch (err) {
                if (isDev()) {
                  console.error("Fallback complete-upload failed:", err);
                }
              }
            }
          })
          .catch((error) => {
            if (isDev()) {
              console.error("Upload failed:", error);
            }
          });

        // Optional dev-only poll to check if the transcript is fully uploaded
        // Skip for admin uploads since they trigger the webhook directly
        if (isDev() && !impersonatedUserId) {
          fetch("/api/dev-only-poll-for-upload-complete", {
            method: "POST",
            body: JSON.stringify({
              transcriptId: createIdResponse.transcriptId,
              region,
            }),
          });
        }

        safeCapture("on_drop_finished", {
          transcript_id: createIdResponse.transcriptId,
          use_bigger_part_size: useBiggerPartSize,
          duration: timer.stop("on_drop"),
          region,
        });
      } catch (err) {
        console.error(err);
        safeCapture("on_drop_errored", {
          error: err instanceof Error ? err.stack : err,
        });

        setIsTransitioning(false);
      }
    },
    [prompt, impersonatedUserId, onUploadComplete, router, updateUploadUri, orgId]
  );

  const onWarningAccepted = useCallback(() => {
    setShowWarningModal(false);
    if (typeof window !== "undefined") {
      sessionStorage.setItem("upload-warning-accepted", "1");
    }
    const files = pendingFilesRef.current;
    pendingFilesRef.current = null;
    if (files) {
      executeUpload(files);
    }
  }, [executeUpload]);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      // For regular (non-admin) uploads, show the warning modal once per session
      if (
        !impersonatedUserId &&
        typeof window !== "undefined" &&
        !sessionStorage.getItem("upload-warning-accepted")
      ) {
        pendingFilesRef.current = acceptedFiles;
        setShowWarningModal(true);
        return;
      }
      await executeUpload(acceptedFiles);
    },
    [impersonatedUserId, executeUpload]
  );

  return {
    onDrop,
    isTransitioning,
    showWarningModal,
    onWarningAccepted,
  };
}
