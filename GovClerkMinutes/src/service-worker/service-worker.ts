import { PresignedUrl } from "@/common/types";
import { uploadPartOfMultipartUpload } from "../common/multipartUpload";
import uploadAllPending from "../common/uploadAllPending";
import { sendMessage } from "./messages";
import { getAllTranscriptIds, getUploadPartsForTranscript } from "@/common/indexeddb";
import { uploadWithAdaptiveConcurrency, DEFAULT_OPTIONS } from "@/common/adaptiveConcurrency";

async function uploadFileImpl(transcriptId: number, partNumber: number): Promise<void> {
  const uploadStart = Date.now();

  return await uploadPartOfMultipartUpload(transcriptId, partNumber, {
    onFetchStarting: async (transcriptId, partNumber, uploadId) => {
      await sendMessage({
        kind: "sw_fetch_starting",
        properties: {
          transcriptId,
          partNumber,
          uploadId,
        },
      });
    },
    onFetchFinished: async (transcriptId, partNumber, durationSecs, response) => {
      await sendMessage({
        kind: "sw_fetch_finished",
        properties: {
          transcriptId,
          partNumber,
          durationSecs,
          response,
        },
      });
    },
    onFetchFullyFinished: async (transcriptId, response) => {
      await sendMessage({
        kind: "sw_fetch_fully_finished",
        properties: {
          transcriptId,
          response,
          duration: Date.now() - uploadStart,
          isAdaptive: false,
        },
      });
    },
  });
}

async function uploadFile(transcriptId: number, numParts: number): Promise<void> {
  for (let partNumber = 1; partNumber <= numParts; partNumber++) {
    try {
      await uploadFileImpl(transcriptId, partNumber);
    } catch (err) {
      const errorInfo = err instanceof Error ? { message: err.message, stack: err.stack } : err;
      await sendMessage({
        kind: "sw_fetch_errored",
        properties: {
          transcriptId,
          partNumber,
          error: JSON.stringify(errorInfo),
          isAdaptive: false,
        },
      });

      // Rethrow so we get retried
      throw err;
    }
  }
}

async function uploadFileWithAdaptiveConcurrencyImpl(transcriptId: number): Promise<void> {
  const uploadParts = await getUploadPartsForTranscript(transcriptId);

  if (uploadParts == null) {
    throw new Error("Upload parts not found for transcript");
  }

  const uploadStart = Date.now();

  uploadWithAdaptiveConcurrency(
    transcriptId,
    uploadParts,
    {
      ...DEFAULT_OPTIONS,
      initialConcurrency: 2,
      increaseRate: 2,
    },
    {
      onFetchStarting: async (transcriptId, partNumber, uploadId) => {
        await sendMessage({
          kind: "sw_fetch_starting",
          properties: {
            transcriptId,
            partNumber,
            uploadId,
          },
        });
      },
      onFetchFinished: async (transcriptId, partNumber, durationSecs, response) => {
        await sendMessage({
          kind: "sw_fetch_finished",
          properties: {
            transcriptId,
            partNumber,
            durationSecs,
            response,
          },
        });
      },
      onFetchFullyFinished: async (transcriptId, response) => {
        await sendMessage({
          kind: "sw_fetch_fully_finished",
          properties: {
            transcriptId,
            response,
            duration: Date.now() - uploadStart,
            isAdaptive: true,
          },
        });
      },
      onFetchRetry: async (properties) => {
        await sendMessage({
          kind: "sw_fetch_retry",
          properties,
        });
      },
      onFetchChunkUpload: async (properties) => {
        await sendMessage({
          kind: "sw_fetch_chunk_upload",
          properties,
        });
      },
    }
  );
}

async function uploadFileWithAdaptiveConcurrency(transcriptId: number): Promise<void> {
  try {
    await uploadFileWithAdaptiveConcurrencyImpl(transcriptId);
  } catch (err) {
    const errorInfo = err instanceof Error ? { message: err.message, stack: err.stack } : err;
    await sendMessage({
      kind: "sw_fetch_errored",
      properties: {
        transcriptId,
        error: JSON.stringify(errorInfo),
        isAdaptive: true,
      },
    });

    // Rethrow so we get retried
    throw err;
  }
}

async function uploadAllPendingWithAdaptive(): Promise<void> {
  const transcriptIds = await getAllTranscriptIds();

  for (const transcriptId of transcriptIds) {
    try {
      await uploadFileWithAdaptiveConcurrencyImpl(transcriptId);
    } catch (err) {
      const errorInfo = err instanceof Error ? { message: err.message, stack: err.stack } : err;
      await sendMessage({
        kind: "sw_pending_fetch_errored",
        properties: {
          transcriptId,
          error: JSON.stringify(errorInfo),
          isAdaptive: true,
        },
      });

      // Rethrow so we get retried
      throw err;
    }
  }
}

self.addEventListener("sync", (event: any) => {
  if (event.tag.startsWith("mg-sync-upload-")) {
    const transcriptId = parseInt(event.tag.split("-")[3]);
    const numParts = parseInt(event.tag.split("-")[4]);
    const isAdaptiveConcurrency = parseInt(event.tag.split("-")[5]);
    if (isAdaptiveConcurrency === 0) {
      event.waitUntil(uploadFile(transcriptId, numParts));
    } else {
      event.waitUntil(uploadFileWithAdaptiveConcurrency(transcriptId));
    }
  } else if (event.tag === "mg-sync-request-upload-pending") {
    event.waitUntil(
      uploadAllPending(
        {
          onFetchStarting: async (transcriptId, partNumber, uploadId) => {
            await sendMessage({
              kind: "sw_pending_fetch_starting",
              properties: {
                transcriptId,
                partNumber,
                uploadId,
              },
            });
          },
          onFetchFinished: async (transcriptId, partNumber, durationSecs, response) => {
            await sendMessage({
              kind: "sw_pending_fetch_finished",
              properties: {
                transcriptId,
                partNumber,
                durationSecs,
                response,
              },
            });
          },
          onFetchFullyFinished: async (transcriptId, response) => {
            await sendMessage({
              kind: "sw_pending_fetch_fully_finished",
              properties: {
                transcriptId,
                response,
              },
            });
          },
        },
        async (error) =>
          sendMessage({
            kind: "sw_all_pending_fetch_errored",
            properties: {
              error,
            },
          }),
        (transcriptId) => {
          return sendMessage({
            kind: "sw_url_refresh",
            properties: {
              transcriptId,
            },
          });
        }
      )
    );
  } else if (event.tag === "mg-sync-request-upload-pending-adaptive") {
    uploadAllPendingWithAdaptive();
  }
});

self.addEventListener("install", (event: any) => {
  event.waitUntil((self as any as ServiceWorkerGlobalScope).skipWaiting());
});

self.addEventListener("activate", (event: any) => {
  event.waitUntil((self as any as ServiceWorkerGlobalScope).clients.claim());
});

const sharedFiles = new Map<string, File>();
const SHARE_TARGET_PATH = "/share-target";
const FILE_CLEANUP_TIMEOUT = 5 * 60 * 1000;
const MAX_FILE_SIZE = 3 * 1024 * 1024 * 1024;

self.addEventListener("fetch", (event: any) => {
  const url = new URL(event.request.url);
  const isShareTarget =
    (url.pathname === SHARE_TARGET_PATH || url.pathname === `${SHARE_TARGET_PATH}/`) &&
    event.request.method === "POST";

  if (isShareTarget) {
    event.respondWith(handleShareTarget(event.request));
  }
});

const DASHBOARD_BASE_URL = "/dashboard";

function buildErrorRedirect(reason: string, additionalParams?: Record<string, string>): string {
  const params = new URLSearchParams({ shared: "error", reason, ...additionalParams });
  return `${DASHBOARD_BASE_URL}?${params}`;
}

function buildSuccessRedirect(token: string): string {
  return `${DASHBOARD_BASE_URL}?shared=1&token=${token}`;
}

async function handleShareTarget(request: Request): Promise<Response> {
  try {
    const formData = await request.formData();
    const files = formData.getAll("file") as File[];

    if (files.length === 0) {
      return Response.redirect(buildErrorRedirect("no_file"), 302);
    }

    if (files.length > 1) {
      const allImages = files.every((f) => f.type.startsWith("image/"));
      if (!allImages) {
        return Response.redirect(buildErrorRedirect("multiple_files"), 302);
      }
    }

    const file = files[0];

    if (file.size > MAX_FILE_SIZE) {
      return Response.redirect(
        buildErrorRedirect("file_too_large", { size: String(file.size) }),
        302
      );
    }

    const token = crypto.randomUUID();
    sharedFiles.set(token, file);

    setTimeout(() => sharedFiles.delete(token), FILE_CLEANUP_TIMEOUT);

    return Response.redirect(buildSuccessRedirect(token), 302);
  } catch (error) {
    console.error("Error handling share target:", error);
    return Response.redirect(buildErrorRedirect("processing_failed"), 302);
  }
}

self.addEventListener("message", (event: any) => {
  const { kind, token } = event.data;

  if (kind === "gc_shared_file_request") {
    const file = sharedFiles.get(token);
    event.ports[0]?.postMessage({
      kind: "gc_shared_file_response",
      token,
      ok: !!file,
      file: file || null,
    });
  } else if (kind === "gc_shared_file_discard") {
    sharedFiles.delete(token);
  }
});

self.addEventListener("push", (event: any) => {
  // Push notifications: prefer JSON payload { title?, body?, tag?, url? } sent via web-push; fallback to defaults
  // Prefer decrypted payload if available; otherwise show a generic notification
  let title = "GovClerkMinutes";
  let body = "New WhatsApp message received";
  let tag = "mg-whatsapp";
  let data: any = { url: "/admin?tool=5" };

  try {
    if (event.data) {
      // Try to parse as JSON payload { title?, body?, tag? }
      const parsed = (() => {
        try {
          return event.data.json();
        } catch {
          const txt = event.data.text?.();
          if (typeof txt === "string") {
            try {
              return JSON.parse(txt);
            } catch {
              return null;
            }
          }
          return null;
        }
      })();

      if (parsed && typeof parsed === "object") {
        if (typeof parsed.title === "string" && parsed.title.length > 0) {
          title = parsed.title;
        }
        if (typeof parsed.body === "string" && parsed.body.length > 0) {
          body = parsed.body;
        }
        if (typeof parsed.tag === "string" && parsed.tag.length > 0) {
          tag = parsed.tag;
        }
        if (typeof (parsed as any).url === "string" && (parsed as any).url.length > 0) {
          data = { ...(data || {}), url: (parsed as any).url };
        }
      }
    }
  } catch (e) {
    // Ignore payload parse errors; fall back to defaults
  }

  const showPromise = (self as any as ServiceWorkerGlobalScope).registration.showNotification(
    title,
    {
      body,
      tag,
      icon: "/icon.svg",
      badge: "/icon.svg",
      data,
    }
  );

  event.waitUntil(showPromise);
});

// Focus an existing client or open a new window to the admin WhatsApps view
self.addEventListener("notificationclick", (event: any) => {
  event.notification.close();
  const targetUrl: string = event.notification?.data?.url || "/admin";

  const openOrFocus = async () => {
    const allClients = await (self as any as ServiceWorkerGlobalScope).clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    });

    // Try to focus an existing tab with our origin
    for (const client of allClients) {
      try {
        const url = new URL((client as any).url);
        if (url.pathname.startsWith("/admin")) {
          await (client as WindowClient).focus();
          await (client as WindowClient).navigate(targetUrl);
          return;
        }
      } catch (e) {
        // Ignore parse errors
      }
    }

    // Otherwise open a new window
    await (self as any as ServiceWorkerGlobalScope).clients.openWindow(targetUrl);
  };

  event.waitUntil(openOrFocus());
});
