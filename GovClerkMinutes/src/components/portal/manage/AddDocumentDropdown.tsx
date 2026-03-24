import { useRef, useCallback, useState } from "react";
import { LuFilePlus, LuLoader2 } from "react-icons/lu";
import { toast } from "sonner";
import type { PortalArtifactType, PortalArtifact } from "@/types/portal";
import { useOrgContext } from "@/contexts/OrgContext";

const ACCEPTED_FILE_TYPES = ".pdf,.doc,.docx,.png,.jpg,.jpeg,.gif,.mp4,.webm,.mp3,.m4a";

interface AddDocumentDropdownProps {
  meetingId: number;
  onArtifactAdded?: (artifact: PortalArtifact) => void;
}

export function AddDocumentDropdown({ meetingId, onArtifactAdded }: AddDocumentDropdownProps) {
  const { orgId } = useOrgContext();
  const [isUploading, setIsUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const uploadFile = useCallback(
    async (file: File) => {
      // Determine artifact type from file extension
      const ext = file.name.split(".").pop()?.toLowerCase();
      let artifactType: PortalArtifactType = "other";
      if (["mp4", "webm", "mp3", "m4a"].includes(ext || "")) {
        artifactType = "recordings";
      }

      setIsUploading(true);

      try {
        const presignResponse = await fetch("/api/portal/artifacts/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            meetingId,
            artifactType,
            fileName: file.name,
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

        const xhr = new XMLHttpRequest();

        await new Promise<void>((resolve, reject) => {
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

        toast.success(`${file.name} has been uploaded successfully.`);

        onArtifactAdded?.(artifact);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Upload failed";
        toast.error(message);
      } finally {
        setIsUploading(false);
      }
    },
    [meetingId, orgId, onArtifactAdded]
  );

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      uploadFile(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={isUploading}
        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
        aria-label="Add Document"
        title="Add Document"
      >
        {isUploading ? (
          <LuLoader2 className="w-4 h-4 animate-spin" />
        ) : (
          <LuFilePlus className="w-4 h-4" />
        )}
      </button>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept={ACCEPTED_FILE_TYPES}
        onChange={handleFileChange}
      />
    </>
  );
}
