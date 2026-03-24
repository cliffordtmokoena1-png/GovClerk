import { DBSchema } from "idb";
import { openDB } from "./utils/retryableIdb";
import { PresignedUrl } from "./types";
import { upgradeDb } from "./upgrade";
import { PRESIGNED_URL_TTL } from "./constants";

export type RecordingSessionState = "recording" | "paused" | "completed" | "recovered" | "expired";

// Recording-specific constants
export const RECORDING_CONSTANTS = {
  STALE_TIMEOUT_MS: 30 * 1000, // 30 seconds
  CHUNK_DURATION_MS: 5000, // 5 seconds
  CRASH_TIMEOUT_MS: 30 * 1000, // 30 seconds
  DEFAULT_CLEANUP_AGE_MS: 7 * 24 * 60 * 60 * 1000, // 7 days
} as const;

export interface RecordingSessionMetadata {
  sessionId: string;
  startTime: number; // Unix timestamp in ms
  lastChunkTime: number; // Unix timestamp in ms of last chunk save
  accumulatedDuration: number; // Duration in seconds
  state: RecordingSessionState;
  mimeType: string;
  recordingOptions: MediaRecorderOptions;
  chunkDuration: number; // Duration of each chunk in ms (5000ms)
  chunkCount: number; // Number of chunks stored
}

export interface RecordingSessionChunk {
  sessionId: string;
  chunkIndex: number; // 0-based index
  blob: Blob;
  timestamp: number; // Unix timestamp in ms when chunk was created
}

export interface UploadsSchema extends DBSchema {
  files: {
    key: number;
    value: {
      transcriptId: number;
      file: File;
    };
  };

  transcripts: {
    key: number;
    value: {
      transcriptId: number;
      done: boolean;
      uploadId: string;
      numParts: number; // These are 1-indexed
      createdAt: number; // Unix timestamp in ms
      lastSentAt?: number; // Timestamp last sent at in ms
      isAdminUpload?: boolean; // Whether this is an admin upload
    };
  };

  uploadParts: {
    key: string; // Looks like `${transcriptId}-${partNumber}`
    value: {
      transcriptId: number;
      partNumber: number;
      url: string;
      start: number;
      end: number;
      expiresAt: number; // Presigned URL expiration
      eTag: string | null;
    };
  };

  uploadIndex: {
    key: number; // transcriptId
    value: number; // partNumber
  };

  recordingSessionMetadata: {
    key: string; // sessionId
    value: RecordingSessionMetadata;
  };

  recordingSessionChunks: {
    key: string; // `${sessionId}-${chunkIndex}`
    value: RecordingSessionChunk;
  };
}

export const UPLOADS_VERSION = 9;

export function getUploadPartsKey(transcriptId: number, partNumber: number): string {
  return `${transcriptId}-${partNumber}`;
}

export function getRecordingChunkKey(sessionId: string, chunkIndex: number): string {
  return `${sessionId}-${chunkIndex}`;
}

// Creates records in two different object stores.
// First store is for the upload metadata, file blob, etc.
// Second store is for the parts of the upload, presigned URLs, eTags, etc.
export async function storeUploadedFile(
  transcriptId: number,
  file: File,
  uploadId?: string,
  presignedUrls?: Array<PresignedUrl>,
  isAdminUpload?: boolean
) {
  const db = await openDB<UploadsSchema>("uploads", UPLOADS_VERSION, {
    upgrade: upgradeDb,
  });

  const filesTx = db.transaction("files", "readwrite");
  const filesStore = filesTx.objectStore("files");
  await filesStore.put({
    transcriptId,
    file,
  });

  await filesTx.done;

  if (uploadId == null || presignedUrls == null) {
    db.close();
    return;
  }

  const transcriptsTx = db.transaction("transcripts", "readwrite");
  const transcriptsStore = transcriptsTx.objectStore("transcripts");
  await transcriptsStore.put({
    transcriptId,
    done: false,
    uploadId,
    numParts: presignedUrls.length,
    createdAt: Date.now(),
    lastSentAt: undefined,
    isAdminUpload,
  });

  await transcriptsTx.done;

  const uploadPartsTx = db.transaction("uploadParts", "readwrite");
  const uploadPartsStore = uploadPartsTx.objectStore("uploadParts");

  await Promise.all(
    presignedUrls.map((presignedUrl) => {
      return uploadPartsStore.put(
        {
          transcriptId,
          partNumber: presignedUrl.partNumber,
          url: presignedUrl.url,
          start: presignedUrl.start,
          end: presignedUrl.end,
          expiresAt: Date.now() + 1000 * PRESIGNED_URL_TTL,
          eTag: null,
        },
        getUploadPartsKey(transcriptId, presignedUrl.partNumber)
      );
    })
  );

  await uploadPartsTx.done;

  db.close();
}

export async function getUploadPartRecordFromStorage(
  transcriptId: number,
  partNumber: number
): Promise<UploadsSchema["uploadParts"]["value"]> {
  const db = await openDB<UploadsSchema>("uploads", UPLOADS_VERSION, {
    upgrade: upgradeDb,
  });
  const tx = db.transaction("uploadParts", "readonly");
  const store = tx.objectStore("uploadParts");

  const record = await store.get(getUploadPartsKey(transcriptId, partNumber));

  if (record == null) {
    throw new Error(`uploadPart record is missing ${transcriptId} ${partNumber}`);
  }

  await tx.done;

  return record;
}

export async function getFileFromStorage(transcriptId: number): Promise<File | undefined> {
  const db = await openDB<UploadsSchema>("uploads", UPLOADS_VERSION, {
    upgrade: upgradeDb,
  });
  const tx = db.transaction("files", "readonly");
  const store = tx.objectStore("files");

  const fileRecord = await store.get(transcriptId);

  await tx.done;

  return fileRecord?.file;
}

export async function getTranscriptRecordFromStorage(
  transcriptId: number
): Promise<UploadsSchema["transcripts"]["value"] | undefined> {
  const db = await openDB<UploadsSchema>("uploads", UPLOADS_VERSION, {
    upgrade: upgradeDb,
  });
  const tx = db.transaction("transcripts", "readonly");
  const store = tx.objectStore("transcripts");

  const fileRecord = await store.get(transcriptId);

  await tx.done;

  return fileRecord;
}

export async function updatePresignedUrlETag(
  transcriptId: number,
  partNumber: number,
  eTag: string
): Promise<void> {
  const db = await openDB<UploadsSchema>("uploads", UPLOADS_VERSION, {
    upgrade: upgradeDb,
  });

  const tx = db.transaction("uploadParts", "readwrite");
  const store = tx.objectStore("uploadParts");

  const record = await store.get(getUploadPartsKey(transcriptId, partNumber));
  if (!record) {
    throw new Error(`Transcript ${transcriptId} ${partNumber} not found`);
  }

  await store.put({ ...record, eTag }, getUploadPartsKey(transcriptId, partNumber));

  await tx.done;
}

export async function updateLastSentAt(transcriptId: number, partNumber: number): Promise<void> {
  const db = await openDB<UploadsSchema>("uploads", UPLOADS_VERSION, {
    upgrade: upgradeDb,
  });

  const tx = db.transaction("transcripts", "readwrite");
  const store = tx.objectStore("transcripts");

  const record = await store.get(transcriptId);

  if (!record) {
    throw new Error(`Transcript ${transcriptId} not found`);
  }

  await store.put({ ...record, lastSentAt: Date.now() });

  await tx.done;
}

export async function updateTranscriptDone(transcriptId: number): Promise<void> {
  const db = await openDB<UploadsSchema>("uploads", UPLOADS_VERSION, {
    upgrade: upgradeDb,
  });
  const tx = db.transaction("transcripts", "readwrite");
  const store = tx.objectStore("transcripts");
  const record = await store.get(transcriptId);
  if (!record) {
    throw new Error(`Transcript ${transcriptId} not found when marking done`);
  }
  await store.put({
    ...record,
    done: true,
  });

  await tx.done;
}

export async function allUploadPartsComplete(
  transcriptId: number,
  numParts: number
): Promise<Array<{ partNumber: number; eTag: string }> | null> {
  const db = await openDB<UploadsSchema>("uploads", UPLOADS_VERSION, {
    upgrade: upgradeDb,
  });

  const tx = db.transaction("uploadParts", "readonly");
  const store = tx.objectStore("uploadParts");

  const keys = Array.from(Array(numParts).keys()).map((partNumber) =>
    getUploadPartsKey(transcriptId, partNumber + 1)
  );

  const parts = await Promise.all(keys.map((key) => store.get(key)));

  await tx.done;

  if (!parts.every((part) => part?.eTag != null)) {
    return null;
  }

  return parts.map((part) => ({
    partNumber: part!.partNumber,
    eTag: part!.eTag!,
  }));
}

export async function getUploadPartsForTranscript(
  transcriptId: number
): Promise<Array<UploadsSchema["uploadParts"]["value"]> | null> {
  const db = await openDB<UploadsSchema>("uploads", UPLOADS_VERSION, {
    upgrade: upgradeDb,
  });

  const transcript = await db.get("transcripts", transcriptId);
  if (transcript == null) {
    return null;
  }

  const tx = db.transaction("uploadParts", "readonly");
  const store = tx.objectStore("uploadParts");

  const keys = Array.from(Array(transcript.numParts).keys()).map((partNumber) =>
    getUploadPartsKey(transcriptId, partNumber + 1)
  );

  const parts = await Promise.all(keys.map((key) => store.get(key)));

  await tx.done;

  return parts.filter((part): part is UploadsSchema["uploadParts"]["value"] => part != null);
}

export async function getAllTranscriptIds(): Promise<number[]> {
  const db = await openDB<UploadsSchema>("uploads", UPLOADS_VERSION, {
    upgrade: upgradeDb,
  });
  const tx = db.transaction("transcripts", "readonly");
  const store = tx.objectStore("transcripts");

  const transcriptIds = await store.getAllKeys();

  await tx.done;

  return transcriptIds as number[];
}

export async function deleteTranscriptRecords(
  transcriptId: number,
  numParts: number
): Promise<void> {
  const db = await openDB<UploadsSchema>("uploads", UPLOADS_VERSION, {
    upgrade: upgradeDb,
  });

  await Promise.all(
    Array.from(Array(numParts).keys())
      .map((partNumber) => getUploadPartsKey(transcriptId, partNumber + 1))
      .map((key) => db.delete("uploadParts", key))
      .concat([db.delete("transcripts", transcriptId), db.delete("files", transcriptId)])
  );
}

export function isTranscriptTimedOut(transcript: UploadsSchema["transcripts"]["value"]) {
  const msPerDay = 1000 * 60 * 60 * 24;
  return transcript.createdAt == null || Date.now() > transcript.createdAt + msPerDay;
}

// Check to make sure we don't send duplicate requests for a chunk within a
// certain window to avoid congestion.
export function isTranscriptSendable(transcript: UploadsSchema["transcripts"]["value"]) {
  const tenMins = 1000 * 60 * 10;
  // lastSentAt == null means we haven't yet tried to send it.
  return transcript.lastSentAt == null || Date.now() > transcript.lastSentAt + tenMins;
}

export function isTranscriptRetryable(transcript: UploadsSchema["transcripts"]["value"]): boolean {
  return (
    !transcript.done &&
    transcript.uploadId != null &&
    !isTranscriptTimedOut(transcript) &&
    isTranscriptSendable(transcript)
  );
}

export async function saveLastIndexUploaded(transcriptId: number, index: number) {
  const db = await openDB<UploadsSchema>("uploads", UPLOADS_VERSION, {
    upgrade: upgradeDb,
  });
  const tx = db.transaction("uploadIndex", "readwrite");
  const store = tx.objectStore("uploadIndex");
  await store.put(index, transcriptId);
  await tx.done;
}

export async function getLastIndexUploaded(transcriptId: number): Promise<number | undefined> {
  const db = await openDB<UploadsSchema>("uploads", UPLOADS_VERSION, {
    upgrade: upgradeDb,
  });
  const tx = db.transaction("uploadIndex", "readonly");
  const store = tx.objectStore("uploadIndex");
  const lastIndex = await store.get(transcriptId);
  await tx.done;
  return lastIndex;
}

export async function createRecordingSession(metadata: RecordingSessionMetadata): Promise<void> {
  const db = await openDB<UploadsSchema>("uploads", UPLOADS_VERSION, {
    upgrade: upgradeDb,
  });
  const tx = db.transaction("recordingSessionMetadata", "readwrite");
  const store = tx.objectStore("recordingSessionMetadata");
  await store.put(metadata);
  await tx.done;
}

export async function saveSessionChunk(sessionId: string, chunk: Blob): Promise<void> {
  const validatedMetadata = await getRunningRecordingMetadata(sessionId);

  const db = await openDB<UploadsSchema>("uploads", UPLOADS_VERSION, {
    upgrade: upgradeDb,
  });

  const tx = db.transaction(["recordingSessionMetadata", "recordingSessionChunks"], "readwrite");
  const metadataStore = tx.objectStore("recordingSessionMetadata");
  const chunksStore = tx.objectStore("recordingSessionChunks");

  const currentTime = Date.now();
  const chunkIndex = validatedMetadata.chunkCount;

  const updatedMetadata = {
    ...validatedMetadata,
    chunkCount: chunkIndex + 1,
    lastChunkTime: currentTime,
  };
  await metadataStore.put(updatedMetadata);

  const chunkKey = getRecordingChunkKey(sessionId, chunkIndex);
  const chunkRecord: RecordingSessionChunk = {
    sessionId,
    chunkIndex,
    blob: chunk,
    timestamp: currentTime,
  };
  await chunksStore.put(chunkRecord, chunkKey);

  await tx.done;
}

export async function updateSessionDuration(sessionId: string, duration: number): Promise<void> {
  const validatedMetadata = await getRunningRecordingMetadata(sessionId);

  const db = await openDB<UploadsSchema>("uploads", UPLOADS_VERSION, {
    upgrade: upgradeDb,
  });
  const tx = db.transaction("recordingSessionMetadata", "readwrite");
  const store = tx.objectStore("recordingSessionMetadata");

  await store.put({
    ...validatedMetadata,
    accumulatedDuration: duration,
    lastChunkTime: Date.now(),
  });

  await tx.done;
}

export async function updateSessionState(
  sessionId: string,
  state: RecordingSessionState
): Promise<void> {
  // For recording/paused states, validate first
  let validatedMetadata: RecordingSessionMetadata;
  if (state === "recording" || state === "paused") {
    validatedMetadata = await getRunningRecordingMetadata(sessionId);
  } else {
    // For other states, just check if session exists
    const metadata = await getRecordingSessionMetadata(sessionId);
    if (!metadata) {
      throw new Error(`Recording session ${sessionId} not found`);
    }
    validatedMetadata = metadata;
  }

  const db = await openDB<UploadsSchema>("uploads", UPLOADS_VERSION, {
    upgrade: upgradeDb,
  });
  const tx = db.transaction("recordingSessionMetadata", "readwrite");
  const store = tx.objectStore("recordingSessionMetadata");

  await store.put({
    ...validatedMetadata,
    state,
    lastChunkTime: Date.now(),
  });

  await tx.done;
}

export async function getRecordingSessionMetadata(): Promise<RecordingSessionMetadata[]>;
export async function getRecordingSessionMetadata(
  sessionId: string
): Promise<RecordingSessionMetadata | undefined>;
export async function getRecordingSessionMetadata(
  sessionId?: string
): Promise<RecordingSessionMetadata | RecordingSessionMetadata[] | undefined> {
  const db = await openDB<UploadsSchema>("uploads", UPLOADS_VERSION, {
    upgrade: upgradeDb,
  });
  const tx = db.transaction("recordingSessionMetadata", "readonly");
  const store = tx.objectStore("recordingSessionMetadata");

  const result = sessionId ? await store.get(sessionId) : await store.getAll();

  await tx.done;

  return result;
}

export async function deleteRecordingSession(sessionId: string): Promise<void> {
  const db = await openDB<UploadsSchema>("uploads", UPLOADS_VERSION, {
    upgrade: upgradeDb,
  });

  const tx = db.transaction(["recordingSessionMetadata", "recordingSessionChunks"], "readwrite");
  const metadataStore = tx.objectStore("recordingSessionMetadata");
  const chunksStore = tx.objectStore("recordingSessionChunks");

  const metadata = await metadataStore.get(sessionId);

  if (metadata) {
    await metadataStore.delete(sessionId);

    for (let i = 0; i < metadata.chunkCount; i++) {
      const chunkKey = getRecordingChunkKey(sessionId, i);
      await chunksStore.delete(chunkKey);
    }
  }

  await tx.done;
}

export async function completeSession(
  sessionId: string,
  finalDuration?: number
): Promise<Blob | null> {
  const db = await openDB<UploadsSchema>("uploads", UPLOADS_VERSION, {
    upgrade: upgradeDb,
  });

  const tx = db.transaction("recordingSessionMetadata", "readwrite");
  const metadataStore = tx.objectStore("recordingSessionMetadata");
  const metadata = await metadataStore.get(sessionId);

  if (!metadata) {
    await tx.done;
    return null;
  }

  await metadataStore.put({
    ...metadata,
    state: "completed" as RecordingSessionState,
    accumulatedDuration: finalDuration !== undefined ? finalDuration : metadata.accumulatedDuration,
    lastChunkTime: Date.now(),
  });

  await tx.done;

  return await createBlobFromSessionChunks(sessionId);
}

export async function createBlobFromSessionChunks(sessionId: string): Promise<Blob | null> {
  const db = await openDB<UploadsSchema>("uploads", UPLOADS_VERSION, {
    upgrade: upgradeDb,
  });

  const metadataTx = db.transaction("recordingSessionMetadata", "readonly");
  const metadataStore = metadataTx.objectStore("recordingSessionMetadata");
  const metadata = await metadataStore.get(sessionId);
  await metadataTx.done;

  if (!metadata) {
    return null;
  }

  const chunksTx = db.transaction("recordingSessionChunks", "readonly");
  const chunksStore = chunksTx.objectStore("recordingSessionChunks");

  const chunks: Blob[] = [];
  for (let i = 0; i < metadata.chunkCount; i++) {
    const chunkKey = getRecordingChunkKey(sessionId, i);
    const chunkRecord = await chunksStore.get(chunkKey);
    if (chunkRecord) {
      chunks.push(chunkRecord.blob);
    }
  }

  await chunksTx.done;

  return chunks.length > 0 ? new Blob(chunks, { type: metadata.mimeType }) : null;
}

export async function createBlobFromChunkRange(
  sessionId: string,
  startIndex: number,
  endIndex: number
): Promise<Blob | null> {
  const db = await openDB<UploadsSchema>("uploads", UPLOADS_VERSION, {
    upgrade: upgradeDb,
  });

  const metadataTx = db.transaction("recordingSessionMetadata", "readonly");
  const metadataStore = metadataTx.objectStore("recordingSessionMetadata");
  const metadata = await metadataStore.get(sessionId);
  await metadataTx.done;

  if (!metadata) {
    return null;
  }

  const chunksTx = db.transaction("recordingSessionChunks", "readonly");
  const chunksStore = chunksTx.objectStore("recordingSessionChunks");

  const chunks: Blob[] = [];
  for (let i = startIndex; i <= endIndex && i < metadata.chunkCount; i++) {
    const chunkKey = getRecordingChunkKey(sessionId, i);
    const chunkRecord = await chunksStore.get(chunkKey);
    if (chunkRecord) {
      chunks.push(chunkRecord.blob);
    }
  }

  await chunksTx.done;

  return chunks.length > 0 ? new Blob(chunks, { type: metadata.mimeType }) : null;
}

export async function getCurrentChunkCount(sessionId: string): Promise<number> {
  const db = await openDB<UploadsSchema>("uploads", UPLOADS_VERSION, {
    upgrade: upgradeDb,
  });

  const metadataTx = db.transaction("recordingSessionMetadata", "readonly");
  const metadataStore = metadataTx.objectStore("recordingSessionMetadata");
  const metadata = await metadataStore.get(sessionId);
  await metadataTx.done;

  return metadata?.chunkCount || 0;
}

export function isSessionMetadataStale(metadata: RecordingSessionMetadata): boolean {
  const now = Date.now();
  return now - metadata.lastChunkTime > RECORDING_CONSTANTS.STALE_TIMEOUT_MS;
}

/**
 * Detects recovered recording sessions based on chunk save timeout
 * Sessions are considered recovered if:
 * 1. State is 'recording' or 'paused'
 * 2. Last chunk was saved more than 30 seconds ago
 */
export async function detectAndMarkAllRecoveredSessions(): Promise<RecordingSessionMetadata[]> {
  const db = await openDB<UploadsSchema>("uploads", UPLOADS_VERSION, {
    upgrade: upgradeDb,
  });

  const tx = db.transaction("recordingSessionMetadata", "readwrite");
  const store = tx.objectStore("recordingSessionMetadata");
  try {
    const allSessions = await store.getAll();
    const now = Date.now();
    const recoveredSessions: RecordingSessionMetadata[] = [];

    for (const session of allSessions) {
      const isStuckRecording = session.state === "recording" || session.state === "paused";

      if (!isStuckRecording) {
        continue; // Skip sessions that aren't stuck
      }

      const lastChunkTime = session.lastChunkTime;
      const isValidTimestamp =
        typeof lastChunkTime === "number" && !isNaN(lastChunkTime) && lastChunkTime > 0;

      let shouldMarkAsRecovered = false;
      let timeSinceLastActivity = 0;

      if (!isValidTimestamp) {
        // No chunks were ever saved - use startTime as reference
        timeSinceLastActivity = now - session.startTime;
        shouldMarkAsRecovered = timeSinceLastActivity > RECORDING_CONSTANTS.CRASH_TIMEOUT_MS;
      } else {
        // Normal case - check time since last chunk
        timeSinceLastActivity = now - lastChunkTime;
        shouldMarkAsRecovered = timeSinceLastActivity > RECORDING_CONSTANTS.CRASH_TIMEOUT_MS;
      }

      if (shouldMarkAsRecovered) {
        let estimatedDuration = session.accumulatedDuration;

        if (isValidTimestamp && session.lastChunkTime > session.startTime) {
          estimatedDuration = Math.floor((session.lastChunkTime - session.startTime) / 1000);
        } else if (session.chunkCount > 0) {
          estimatedDuration = Math.floor(
            (session.chunkCount * RECORDING_CONSTANTS.CHUNK_DURATION_MS) / 1000
          );
        }

        const recoveredSession = {
          ...session,
          state: "recovered" as RecordingSessionState,
          accumulatedDuration: estimatedDuration,
        };
        await store.put(recoveredSession);

        recoveredSessions.push(recoveredSession);
      }
    }
    return recoveredSessions;
  } finally {
    await tx.done;
  }
}

export async function cleanupOldRecordingSessions(
  maxAgeMs: number = RECORDING_CONSTANTS.DEFAULT_CLEANUP_AGE_MS
): Promise<number> {
  const db = await openDB<UploadsSchema>("uploads", UPLOADS_VERSION, {
    upgrade: upgradeDb,
  });

  const metadataTx = db.transaction("recordingSessionMetadata", "readonly");
  const metadataStore = metadataTx.objectStore("recordingSessionMetadata");
  const allSessions = await metadataStore.getAll();
  await metadataTx.done;

  const now = Date.now();
  let deletedCount = 0;

  for (const session of allSessions) {
    if (now - session.startTime > maxAgeMs) {
      await deleteRecordingSession(session.sessionId);
      deletedCount++;
    }
  }

  return deletedCount;
}

async function getRunningRecordingMetadata(sessionId: string): Promise<RecordingSessionMetadata> {
  const metadata = await getRecordingSessionMetadata(sessionId);

  if (!metadata) {
    throw new Error(`Recording session ${sessionId} not found`);
  }

  switch (metadata.state) {
    case "completed":
    case "recovered":
    case "recording":
    case "paused":
      // Valid states for recording operations, continue validation
      break;
    default:
      throw new Error(`Session ${metadata.sessionId} has invalid state: ${metadata.state}`);
  }

  const now = Date.now();
  const validationChecks = [
    [!metadata.startTime || metadata.startTime > now, "has invalid start time"],
    [
      !metadata.lastChunkTime || metadata.lastChunkTime < metadata.startTime,
      "has invalid last chunk time",
    ],
    [metadata.accumulatedDuration < 0, "has negative duration"],
    [metadata.chunkCount < 0, "has negative chunk count"],
  ] as const;

  for (const [condition, errorSuffix] of validationChecks) {
    if (condition) {
      throw new Error(`Session ${metadata.sessionId} ${errorSuffix}`);
    }
  }

  return metadata;
}
