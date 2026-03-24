import uploadAllPending from "@/common/uploadAllPending";
import isFbIg from "@/utils/isFbIg";
import { safeCapture } from "@/utils/safePosthog";
import { useEffect } from "react";
import posthog from "posthog-js";

type Props = {};
export default function UploadManager({}: Props) {
  useEffect(() => {
    const requestUploadIfNeeded = async () => {
      const isAdaptiveEnabled = posthog.isFeatureEnabled("adaptive-concurrency-features");

      if (!isAdaptiveEnabled && navigator.serviceWorker && "ready" in navigator.serviceWorker) {
        const registration = await navigator.serviceWorker.ready;

        if ("sync" in registration && !isFbIg(navigator.userAgent)) {
          try {
            // @ts-ignore
            await registration.sync.register(
              `mg-sync-request-upload-pending${
                posthog.isFeatureEnabled("adaptive-concurrency-features") ? "-adaptive" : ""
              }`
            );
            return;
          } catch (e) {
            console.error(e);
          }
        }
      }

      // If we didn't hit the early return above, it means that we don't support
      // service workers.  So we'll try to upload unfinished jobs in the
      // foreground.

      await uploadAllPending(
        {
          onFetchStarting: async (transcriptId, partNumber, uploadId) => {
            safeCapture("fg_pending_fetch_starting", {
              transcriptId,
              partNumber,
              uploadId,
            });
          },

          onFetchFinished: async (transcriptId, partNumber, durationSecs, response) => {
            safeCapture("fg_pending_fetch_finished", {
              transcriptId,
              partNumber,
              durationSecs,
              response,
            });
          },
          onFetchFullyFinished: async (transcriptId, response) => {
            safeCapture("fg_pending_fetch_fully_finished", {
              transcriptId,
              response,
            });
          },
          onFetchRetry: async (properties) => {
            safeCapture("fg_pending_fetch_retry", properties);
          },
        },
        async (error) => {
          safeCapture("fg_all_pending_fetch_errored", {
            error,
          });
        },
        async (transcriptId) => {
          safeCapture("fg_url_refresh", {
            transcriptId,
          });
        }
      );
    };

    requestUploadIfNeeded();

    const intervalId = setInterval(
      () => {
        requestUploadIfNeeded();
      },
      2 * 60 * 1000
    );

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  return null;
}
