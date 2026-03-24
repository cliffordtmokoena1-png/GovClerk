import { useCallback, useState } from "react";
import { toast } from "sonner";
import type { PortalArtifactType, PortalArtifact } from "@/types/portal";
import { useOrgContext } from "@/contexts/OrgContext";
import { getExtname } from "@/utils/fileUtils";

export interface UploadProgress {
  isUploading: boolean;
  progress: number;
  fileName?: string;
}

export interface UploadOptions {
  meetingId: number;
  artifactType?: PortalArtifactType;
  customFileName?: string;
  onProgress?: (progress: number) => void;
  onComplete?: (artifact: PortalArtifact) => void;
  onError?: (error: Error) => void;
}

// Re-export getExtname for backward compatibility
export { getExtname } from "@/utils/fileUtils";

export function getArtifactTypeFromFile(fileName: string): PortalArtifactType {
  const ext = getExtname(fileName).toLowerCase();
  if ([".mp4", ".webm", ".mp3", ".m4a"].includes(ext)) {
    return "recordings";
  }
  return "other";
}

export function useDocumentUpload() {
  const { orgId } = useOrgContext();
  const [uploadState, setUploadState] = useState<UploadProgress>({
    isUploading: false,
    progress: 0,
  });

  const uploadFile = useCallback(
    async (file: File, options: UploadOptions): Promise<PortalArtifact | null> => {
      const { meetingId, artifactType, customFileName, onProgress, onComplete, onError } = options;

      const determinedArtifactType = artifactType ?? getArtifactTypeFromFile(file.name);
      const fileName = customFileName ?? file.name;

      setUploadState({ isUploading: true, progress: 0, fileName });
      onProgress?.(0);

      try {
        // Step 1: Get presigned URL and create artifact record
        const presignResponse = await fetch("/api/portal/artifacts/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            meetingId,
            artifactType: determinedArtifactType,
            fileName,
            fileSize: file.size,
            contentType: file.type || undefined,
            orgId,
          }),
        });

        if (!presignResponse.ok) {
          const errorData = await presignResponse.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to get upload URL");
        }

        const { artifact, uploadUrl } = await presignResponse.json();

        setUploadState((prev) => ({ ...prev, progress: 20 }));
        onProgress?.(20);

        // Step 2: Upload to S3 using XHR for progress tracking
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();

          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const percentComplete = 20 + Math.round((event.loaded / event.total) * 70);
              setUploadState((prev) => ({ ...prev, progress: percentComplete }));
              onProgress?.(percentComplete);
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(new Error(`Upload failed with status ${xhr.status}`));
            }
          };

          xhr.onerror = () => reject(new Error("Upload failed"));
          xhr.onabort = () => reject(new Error("Upload aborted"));

          xhr.open("PUT", uploadUrl);
          xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
          xhr.send(file);
        });

        setUploadState({ isUploading: false, progress: 100 });
        onProgress?.(100);

        toast.success(`${fileName} has been uploaded successfully.`);

        onComplete?.(artifact);
        return artifact;
      } catch (error) {
        const err = error instanceof Error ? error : new Error("Upload failed");

        setUploadState({ isUploading: false, progress: 0 });
        onProgress?.(0);

        toast.error(err.message);

        onError?.(err);
        return null;
      }
    },
    [orgId]
  );

  const uploadAndAttachToAgendaItem = useCallback(
    async (
      meetingId: number,
      agendaItemId: number,
      file: File,
      onProgress?: (progress: number) => void
    ): Promise<PortalArtifact | null> => {
      setUploadState({ isUploading: true, progress: 0, fileName: file.name });
      onProgress?.(0);

      try {
        // Step 1: Get presigned URL and create artifact record (attached to agenda item)
        const presignResponse = await fetch(
          `/api/portal/meetings/${meetingId}/agenda-items/${agendaItemId}/artifacts`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fileName: file.name,
              fileSize: file.size,
              contentType: file.type || undefined,
              orgId,
            }),
          }
        );

        if (!presignResponse.ok) {
          const errorData = await presignResponse.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to get upload URL");
        }

        const { artifact, uploadUrl } = await presignResponse.json();

        if (!uploadUrl) {
          throw new Error("No upload URL returned");
        }

        setUploadState((prev) => ({ ...prev, progress: 20 }));
        onProgress?.(20);

        // Step 2: Upload to S3 using XHR for progress tracking
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();

          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const percentComplete = 20 + Math.round((event.loaded / event.total) * 70);
              setUploadState((prev) => ({ ...prev, progress: percentComplete }));
              onProgress?.(percentComplete);
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(new Error(`Upload failed with status ${xhr.status}`));
            }
          };

          xhr.onerror = () => reject(new Error("Upload failed"));
          xhr.onabort = () => reject(new Error("Upload aborted"));

          xhr.open("PUT", uploadUrl);
          xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
          xhr.send(file);
        });

        setUploadState({ isUploading: false, progress: 100 });
        onProgress?.(100);

        toast.success(`${file.name} has been uploaded and attached.`);

        return artifact;
      } catch (error) {
        const err = error instanceof Error ? error : new Error("Upload failed");

        setUploadState({ isUploading: false, progress: 0 });
        onProgress?.(0);

        toast.error(err.message);

        return null;
      }
    },
    [orgId]
  );

  const resetUploadState = useCallback(() => {
    setUploadState({ isUploading: false, progress: 0 });
  }, []);

  return {
    uploadState,
    uploadFile,
    uploadAndAttachToAgendaItem,
    resetUploadState,
    getArtifactTypeFromFile,
    getExtname,
  };
}
