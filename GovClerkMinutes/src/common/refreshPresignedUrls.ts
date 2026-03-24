import { PRESIGNED_URL_TTL } from "./constants";
import {
  UPLOADS_VERSION,
  UploadsSchema,
  getUploadPartsKey,
  isTranscriptRetryable,
} from "./indexeddb";
import { ApiRefreshPresignedUrlResponse } from "./types";
import { upgradeDb } from "./upgrade";
import { openDB } from "idb";

async function writeRefreshedUrls(
  transcriptId: number,
  expiredRecords: Array<UploadsSchema["uploadParts"]["value"]>,
  presignedUrls: Array<{ partNumber: number; url: string }>
): Promise<void> {
  const db = await openDB<UploadsSchema>("uploads", UPLOADS_VERSION, {
    upgrade: upgradeDb,
  });
  const tx = db.transaction("uploadParts", "readwrite");
  const store = tx.objectStore("uploadParts");

  const expiresAt = Date.now() + 1000 * PRESIGNED_URL_TTL;

  await Promise.all(
    presignedUrls.map(async (url) => {
      const record = expiredRecords.find((record) => record.partNumber === url.partNumber);
      if (record == null) {
        return null;
      }
      return store.put(
        {
          ...record,
          url: url.url,
          expiresAt,
        },
        getUploadPartsKey(transcriptId, url.partNumber)
      );
    })
  );

  await tx.done;
}

async function getExpiredRecords(
  transcriptId: number,
  numParts: number
): Promise<Array<UploadsSchema["uploadParts"]["value"]>> {
  const db = await openDB<UploadsSchema>("uploads", UPLOADS_VERSION, {
    upgrade: upgradeDb,
  });
  const tx = db.transaction("uploadParts", "readonly");
  const store = tx.objectStore("uploadParts");

  const expiredRecords = (
    await Promise.all(
      Array.from({ length: numParts }, async (_, index) => {
        return store.get(getUploadPartsKey(transcriptId, index + 1));
      })
    )
  ).filter(
    (record) => record != null && record.eTag == null && record.expiresAt <= Date.now()
  ) as any as Array<UploadsSchema["uploadParts"]["value"]>;

  await tx.done;

  return expiredRecords;
}

async function refreshPresignedUrlBatch(
  transcriptId: number,
  numParts: number,
  uploadId: string,
  onUrlRefresh: (transcriptId: number) => Promise<void>
): Promise<void> {
  const expiredRecords = await getExpiredRecords(transcriptId, numParts);

  if (expiredRecords.length === 0) {
    // Bail if there's nothing to refresh
    return;
  }

  await onUrlRefresh(transcriptId);

  const res: ApiRefreshPresignedUrlResponse = await fetch("/api/refresh-presigned-urls", {
    method: "POST",
    body: JSON.stringify({
      transcriptId,
      uploadId,
      parts: expiredRecords.map((record) => record.partNumber),
    }),
  }).then((r) => r.json());

  await writeRefreshedUrls(transcriptId, expiredRecords, res.presignedUrls);
}

export default async function refreshPresignedUrls(
  onUrlRefresh: (transcriptId: number) => Promise<void>
): Promise<void> {
  const db = await openDB<UploadsSchema>("uploads", UPLOADS_VERSION, {
    upgrade: upgradeDb,
  });

  const tx = db.transaction("transcripts", "readonly");
  const store = tx.objectStore("transcripts");

  let pendingJobs = [];

  let cursor = await store.openCursor(null, "prev");

  while (cursor != null) {
    const transcript = cursor.value;
    // transcript.uploadId is null from previous schema versions
    if (isTranscriptRetryable(transcript)) {
      pendingJobs.push(
        refreshPresignedUrlBatch(
          transcript.transcriptId,
          transcript.numParts,
          transcript.uploadId,
          onUrlRefresh
        )
      );
    }

    cursor = await cursor.continue();
  }

  await tx.done;
  db.close();

  await Promise.all(pendingJobs);
}
