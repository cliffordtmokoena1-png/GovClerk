import { RecordingSessionMetadata, createBlobFromSessionChunks } from "@/common/indexeddb";

export async function compileRecordingToBlob(sessionId: string): Promise<Blob | null> {
  try {
    return await createBlobFromSessionChunks(sessionId);
  } catch (error) {
    console.error("Error compiling recording blob:", error);
    return null;
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function generateRecordingFilename(metadata: RecordingSessionMetadata): string {
  const date = new Date(metadata.startTime);
  const dateStr = date.toISOString().slice(0, 19).replace(/[:.]/g, "-");

  let extension = ".webm";
  if (metadata.mimeType.includes("mp4")) {
    extension = ".mp4";
  } else if (metadata.mimeType.includes("ogg")) {
    extension = ".ogg";
  } else if (metadata.mimeType.includes("wav")) {
    extension = ".wav";
  } else if (metadata.mimeType.includes("mpeg")) {
    extension = ".mp3";
  }

  return `recording_${dateStr}${extension}`;
}

export async function downloadRecordingSession(
  sessionId: string,
  metadata: RecordingSessionMetadata,
  filename?: string
): Promise<void> {
  const blob = await compileRecordingToBlob(sessionId);
  if (!blob) {
    throw new Error("Failed to compile recording to blob");
  }

  const finalFilename = filename || generateRecordingFilename(metadata);
  downloadBlob(blob, finalFilename);
}

export function getRecordingStateColor(state: string): string {
  switch (state) {
    case "completed":
      return "green";
    case "recording":
      return "blue";
    case "paused":
      return "yellow";
    case "recovered":
      return "purple";
    default:
      return "gray";
  }
}

export function getRecordingStateText(state: string): string {
  switch (state) {
    case "completed":
      return "Completed";
    case "recording":
      return "Recording";
    case "paused":
      return "Paused";
    case "recovered":
      return "Recovered";
    default:
      return state;
  }
}

export async function getAvailableRecordingTime(): Promise<string> {
  try {
    // Check if Storage API is supported
    if (!("storage" in navigator) || !("estimate" in navigator.storage)) {
      return "";
    }

    const estimate = await navigator.storage.estimate();
    const availableBytes = (estimate.quota || 0) - (estimate.usage || 0);

    if (!availableBytes || availableBytes <= 0) {
      return "";
    }

    const bytesPerSecond = 100000 / 5;
    const availableSeconds = Math.floor(availableBytes / bytesPerSecond);
    const availableMinutes = Math.floor(availableSeconds / 60);

    if (availableMinutes < 300) {
      return "You have low storage space, the recorder may stop working.";
    } else {
      return "";
    }
  } catch (error) {
    // Silently fail because is not critical
    return "";
  }
}
