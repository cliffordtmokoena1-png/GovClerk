import { uploadPartOfMultipartUpload } from "./multipartUpload";
import { MultipartUploadCallbacks } from "./multipartUpload";
import { PresignedUrl } from "./types";
import { saveLastIndexUploaded, getLastIndexUploaded } from "./indexeddb";

export type AdaptiveConcurrencyOptions = typeof DEFAULT_OPTIONS;

export const DEFAULT_OPTIONS = {
  initialConcurrency: 1,
  increaseRate: 1,
  maxConcurrency: 5,
  minConcurrency: 1,
  maxRetries: 3,
};

export async function uploadWithAdaptiveConcurrency(
  transcriptId: number,
  presignedUrls: PresignedUrl[],
  options: AdaptiveConcurrencyOptions,
  callbacks: MultipartUploadCallbacks
): Promise<void> {
  let concurrency = options.initialConcurrency;
  let lastIndexed = (await getLastIndexUploaded(transcriptId)) ?? 0;

  const retryCounts: Map<number, number> = new Map();

  for (let i = lastIndexed; i < presignedUrls.length; ) {
    const remainingChunks = presignedUrls.length - i;
    const currentConcurrency = Math.min(concurrency, remainingChunks);
    const chunkSlice = presignedUrls.slice(i, i + currentConcurrency);
    const chunkSliceLength = chunkSlice.length;

    const uploadStart = Date.now();

    const uploadPromises = chunkSlice.map((presignedUrl) =>
      uploadChunkWithRetry(
        transcriptId,
        presignedUrl.partNumber,
        callbacks,
        options.maxRetries,
        retryCounts
      )
    );

    await Promise.all(uploadPromises);

    const uploadEnd = Date.now();
    const duration = uploadEnd - uploadStart;

    const averageDurationPerChunk = duration / chunkSliceLength;

    const oldCurrency = concurrency;

    if (averageDurationPerChunk > 30000) {
      concurrency = options.minConcurrency;
    } else if (averageDurationPerChunk > 10000) {
      concurrency = Math.max(options.minConcurrency, concurrency - 1);
    } else if (averageDurationPerChunk < 5000) {
      concurrency = Math.min(options.maxConcurrency, concurrency + options.increaseRate);
    }

    if (callbacks.onFetchChunkUpload) {
      callbacks.onFetchChunkUpload({
        transcriptId,
        oldCurrency,
        concurrency,
        currentConcurrency,
        remainingChunks,
        totalChunks: presignedUrls.length,
        chunkNumbers: chunkSlice.map((presignedUrl) => presignedUrl.partNumber),
      });
    }

    i += chunkSliceLength;
    await saveLastIndexUploaded(transcriptId, i);
  }

  await saveLastIndexUploaded(transcriptId, 0);
}

async function uploadChunkWithRetry(
  transcriptId: number,
  partNumber: number,
  callbacks: MultipartUploadCallbacks,
  maxRetries: number,
  retryCounts: Map<number, number>
): Promise<void> {
  let retries = retryCounts.get(partNumber) ?? 0;

  while (retries <= maxRetries) {
    const start = performance.now();
    try {
      await uploadPartOfMultipartUpload(transcriptId, partNumber, callbacks);
      return;
    } catch (err) {
      retries += 1;
      retryCounts.set(partNumber, retries);

      if (callbacks.onFetchRetry) {
        const errorInfo = err instanceof Error ? { message: err.message, stack: err.stack } : err;
        await callbacks.onFetchRetry({
          transcriptId,
          partNumber,
          maxRetries,
          retries,
          duration: Math.floor(performance.now() - start),
          error: JSON.stringify(errorInfo),
        });
      }

      if (typeof window !== "undefined" && retries === 1) {
        const errorInfo = err instanceof Error ? err.message : String(err);
        window.dispatchEvent(
          new CustomEvent("upload-chunk-failure", {
            detail: { transcriptId, partNumber, error: errorInfo },
          })
        );
      }

      if (retries > maxRetries) {
        console.error(`Failed to upload part ${partNumber} after ${maxRetries} attempts`);
        throw err;
      } else {
        console.warn(`Retrying upload of part ${partNumber} (attempt ${retries} of ${maxRetries})`);
      }
    }
  }
}
