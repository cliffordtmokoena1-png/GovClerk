import { openDB } from "idb";
import {
  UPLOADS_VERSION,
  UploadsSchema,
  allUploadPartsComplete,
  deleteTranscriptRecords,
  getFileFromStorage,
  getTranscriptRecordFromStorage,
  getUploadPartRecordFromStorage,
  isTranscriptRetryable,
  isTranscriptTimedOut,
  updateLastSentAt,
  updatePresignedUrlETag,
  updateTranscriptDone,
} from "./indexeddb";
import { upgradeDb } from "./upgrade";
import AggregateError from "./AggregateError";

export type MultipartUploadCallbacks = {
  onFetchStarting: (transcriptId: number, partNumber: number, uploadId: string) => Promise<void>;
  onFetchFinished: (
    transcriptId: number,
    partNumber: number,
    durationSecs: number,
    response: string
  ) => Promise<void>;
  onFetchFullyFinished: (transcriptId: number, response: string) => Promise<void>;
  onFetchRetry?: (properties: object) => Promise<void>;
  onFetchChunkUpload?: (properties: object) => void;
};

export async function uploadPartOfMultipartUpload(
  transcriptId: number,
  partNumber: number,
  callbacks: MultipartUploadCallbacks
): Promise<void> {
  const uploadPartRecord = await getUploadPartRecordFromStorage(transcriptId, partNumber);

  if (uploadPartRecord.eTag != null) {
    // Already uploaded so skipping.
    return;
  }

  const transcriptRecord = await getTranscriptRecordFromStorage(transcriptId);

  if (transcriptRecord == null) {
    throw new Error(`transcript record is missing ${transcriptId} ${partNumber}`);
  }

  await callbacks.onFetchStarting(transcriptId, partNumber, transcriptRecord.uploadId);

  const presignedUrl = uploadPartRecord.url;

  let body = await getFileFromStorage(transcriptId);
  if (body == null) {
    throw new Error(`file is missing ${transcriptId}`);
  }
  body = body.slice(uploadPartRecord.start, uploadPartRecord.end) as File;

  await updateLastSentAt(transcriptId, partNumber);

  const start = Date.now();

  const res = await fetch(presignedUrl, {
    method: "PUT",
    body,
  });

  const headers: any = {};
  res.headers.forEach((value, key) => {
    headers[key] = value;
  });

  if (res.ok) {
    await callbacks.onFetchFinished(
      transcriptId,
      partNumber,
      Math.floor((Date.now() - start) / 1000),
      `status ${res.status} statusText ${
        res.statusText
      } bodyText: ${await res.text()} headers: ${JSON.stringify(headers)}`
    );
  } else {
    throw new Error(`Failed to upload file: ${res.status} ${res.statusText} ${await res.text()}`);
  }

  // On Android Chrome, CORS blocks the ETag header from presigned S3 PUT
  // responses. When eTag is missing we store a placeholder so the part is
  // still recorded as uploaded, then skip the client-side completion check and
  // fall through to the server-side fallback (no-parts complete-upload) that
  // is driven by the caller (uploadWithAdaptiveConcurrency .then() block in
  // useFileUploadHandler.ts).
  const eTag = headers["etag"] || null;
  const eTagToStore = eTag ?? "CORS-BLOCKED";

  await updatePresignedUrlETag(transcriptId, partNumber, eTagToStore);

  // When the ETag was blocked by CORS we cannot reliably assemble the parts
  // list client-side. Skip the client-side completion path entirely and let
  // the caller's fallback (server-side ListParts) handle it.
  if (!eTag) {
    return;
  }

  const parts = await allUploadPartsComplete(transcriptId, transcriptRecord.numParts);

  if (parts == null) {
    return;
  }

  // Only include parts with real ETags (not the CORS-BLOCKED placeholder).
  const realParts = parts.filter((p) => p.eTag && p.eTag !== "CORS-BLOCKED");
  if (realParts.length !== transcriptRecord.numParts) {
    // Some parts have placeholder ETags — let the server-side fallback finish.
    return;
  }

  const completeUploadUrl = transcriptRecord.isAdminUpload
    ? "/api/admin/complete-upload"
    : "/api/complete-upload";
  const r = await fetch(completeUploadUrl, {
    method: "POST",
    keepalive: true,
    body: JSON.stringify({
      transcriptId,
      uploadId: transcriptRecord.uploadId,
      parts: realParts.map((url) => ({
        ETag: url.eTag,
        PartNumber: url.partNumber,
      })),
    }),
  });

  if (!r.ok) {
    throw new Error(
      `Failed to complete multipart upload: ${r.status} ${r.statusText} ${await r.text()}`
    );
  }

  await updateTranscriptDone(transcriptId);

  await callbacks.onFetchFullyFinished(
    transcriptId,
    `status ${r.status} statusText ${
      r.statusText
    } bodyText: ${await r.text()} headers: ${JSON.stringify(headers)}`
  );
}

type Task =
  | {
      kind: "uploadPartOfMultipartUpload";
      transcriptId: number;
      partNumber: number;
      callbacks: MultipartUploadCallbacks;
    }
  | {
      kind: "deleteTranscriptRecords";
      transcriptId: number;
      numParts: number;
    };

export async function uploadAllPendingFiles(callbacks: MultipartUploadCallbacks): Promise<void> {
  const db = await openDB<UploadsSchema>("uploads", UPLOADS_VERSION, {
    upgrade: upgradeDb,
  });

  const tx = db.transaction("transcripts", "readwrite");
  const store = tx.objectStore("transcripts");

  let pendingJobs: Task[][] = [];

  let cursor = await store.openCursor(null, "prev");

  while (cursor != null) {
    const transcript = cursor.value;
    if (isTranscriptRetryable(transcript)) {
      await cursor.update({
        ...transcript,
        lastSentAt: Date.now(),
      });

      const tasks: Task[] = Array.from({ length: transcript.numParts }, (_, index) => ({
        kind: "uploadPartOfMultipartUpload",
        transcriptId: transcript.transcriptId,
        partNumber: index + 1,
        callbacks,
      }));
      pendingJobs.push(tasks);
    } else if (isTranscriptTimedOut(transcript)) {
      pendingJobs.push([
        {
          kind: "deleteTranscriptRecords",
          transcriptId: transcript.transcriptId,
          numParts: transcript.numParts,
        },
      ]);

      await cursor.delete();
    }

    cursor = await cursor.continue();
  }

  await tx.done;
  db.close();

  const errors: Error[] = [];

  for (const job of pendingJobs) {
    for (const task of job) {
      try {
        switch (task.kind) {
          case "uploadPartOfMultipartUpload": {
            await uploadPartOfMultipartUpload(task.transcriptId, task.partNumber, task.callbacks);
            break;
          }
          case "deleteTranscriptRecords": {
            await deleteTranscriptRecords(task.transcriptId, task.numParts);
            break;
          }
          default:
            break;
        }
      } catch (err: any) {
        // Save errors until all jobs are tried, and then throw them all at once.
        errors.push(err);
      }
    }
  }

  if (errors.length > 0) {
    throw new AggregateError(
      errors,
      `Failed inside uploadAllPendingFiles with ${errors.length} errors`
    );
  }
}
