import type { Region } from "@/utils/s3";

export type TemplatePresignRequestFile = {
  name: string;
  size: number;
  type?: string | null;
};

export type TemplateReferenceDescriptor = {
  key: string;
  uploadUrl: string;
  contentType: string;
  sampleNumber: number;
  fileName: string;
};

export type TemplatePresignResponse = {
  templateId: string;
  region: Region;
  references: TemplateReferenceDescriptor[];
};

type UploadOptions = {
  files: File[];
  references: TemplateReferenceDescriptor[];
  onProgress?: (progressPercent: number) => void;
};

export function mapFilesToPresignRequest(files: File[]): TemplatePresignRequestFile[] {
  return files.map((file) => ({
    name: file.name,
    size: file.size,
    type: file.type ?? null,
  }));
}

export async function uploadTemplateReferences({
  files,
  references,
  onProgress,
}: UploadOptions): Promise<void> {
  if (files.length !== references.length) {
    throw new Error("Presigned references do not match file count");
  }

  if (files.length === 0) {
    onProgress?.(100);
    return;
  }

  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  const progressByFile = new Array(files.length).fill(0);

  const updateProgress = () => {
    if (totalBytes === 0) {
      onProgress?.(100);
      return;
    }
    const uploaded = progressByFile.reduce((sum, uploadedBytes) => sum + uploadedBytes, 0);
    const percent = Math.min((uploaded / totalBytes) * 100, 100);
    onProgress?.(percent);
  };

  await Promise.all(
    files.map(
      (file, index) =>
        new Promise<void>((resolve, reject) => {
          const reference = references[index];
          const xhr = new XMLHttpRequest();

          xhr.upload.addEventListener("progress", (event) => {
            if (!event.lengthComputable) {
              return;
            }
            progressByFile[index] = event.loaded;
            updateProgress();
          });

          xhr.addEventListener("load", () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              progressByFile[index] = file.size;
              updateProgress();
              resolve();
            } else {
              reject(new Error(`Failed to upload template sample: ${xhr.status}`));
            }
          });

          xhr.addEventListener("error", () => {
            reject(new Error("Network error while uploading template sample"));
          });

          xhr.addEventListener("abort", () => {
            reject(new Error("Template sample upload aborted"));
          });

          xhr.open("PUT", reference.uploadUrl);
          if (reference.contentType) {
            xhr.setRequestHeader("Content-Type", reference.contentType);
          }
          xhr.send(file);
        })
    )
  );

  onProgress?.(100);
}
