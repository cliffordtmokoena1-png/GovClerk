import AggregateError from "./AggregateError";
import { MultipartUploadCallbacks, uploadAllPendingFiles } from "./multipartUpload";
import refreshPresignedUrls from "./refreshPresignedUrls";

export default async function uploadAllPending(
  callbacks: MultipartUploadCallbacks,
  onError: (error: string) => Promise<void>,
  onUrlRefresh: (transcriptId: number) => Promise<void>
): Promise<void> {
  try {
    // Refresh presigned urls first so uploads use refreshed presigned urls
    await refreshPresignedUrls(onUrlRefresh);

    await uploadAllPendingFiles(callbacks);
  } catch (err) {
    let errorInfo;
    if (err instanceof AggregateError) {
      errorInfo = err.toString();
    } else if (err instanceof Error) {
      errorInfo = JSON.stringify({ message: err.message, stack: err.stack });
    } else {
      errorInfo = JSON.stringify(err);
    }

    await onError(errorInfo);

    // Rethrow so we get retried
    throw err;
  }
}
