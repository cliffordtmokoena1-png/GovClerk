import withErrorReporting from "@/error/withErrorReporting";
import {
  maybeHandleVerification,
  validateMetaSignature,
  parseJsonSafe,
} from "@/webhook/whatsapp/auth";
import { WhatsappWebhook } from "@/admin/whatsapp/types";
import { handleWhatsappMessages, handleWhatsAppStatuses } from "@/webhook/whatsapp/handleMessage";
import { serverUri } from "@/utils/server";

export const config = {
  runtime: "edge",
};

/** Fire-and-forget fetch to the Rust server. Never throws. */
function notifyServer(slug: string, body?: object) {
  fetch(serverUri(slug), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.UPLOAD_COMPLETE_WEBHOOK_SECRET}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }).catch((err) => console.warn(`[whatsapp-webhook] notify ${slug} failed:`, err));
}

async function handler(req: Request): Promise<Response> {
  // 1. Handle GET verification challenge
  const verification = maybeHandleVerification(req);
  if (verification) {
    return verification;
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // 2. Read raw body text (needed for signature validation)
  const rawBody = await req.text();

  // 3. Validate signature (if app secret configured). If invalid, reject.
  const valid = await validateMetaSignature(req, rawBody);
  if (!valid) {
    return new Response("Invalid signature", { status: 401 });
  }

  // 4. Parse JSON payload
  const payload = parseJsonSafe<WhatsappWebhook.Payload>(rawBody);
  if (!payload) {
    return new Response("Bad Request", { status: 400 });
  }

  console.info("Received WhatsApp webhook event:", payload);

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      switch (change.field) {
        case "messages": {
          // Isolate handler errors — Meta must always get 200
          if (change.value.messages && change.value.messages.length > 0) {
            try {
              await handleWhatsappMessages(change);
            } catch (err) {
              console.error("[whatsapp-webhook] handleWhatsappMessages failed:", err);
            }
          }
          if (change.value.statuses && change.value.statuses.length > 0) {
            try {
              await handleWhatsAppStatuses(change);
            } catch (err) {
              console.error("[whatsapp-webhook] handleWhatsAppStatuses failed:", err);
            }
          }

          // Fire-and-forget — server being down must not cause a 500
          notifyServer("/admin/api/new-whatsapp");
          break;
        }
        case "calls": {
          const value = change.value;
          const hasCalls = Array.isArray(value?.calls) && value.calls.length > 0;
          if (hasCalls) {
            notifyServer("/admin/api/call", { kind: "calls", value });
          }

          const callStatuses = (value as any)?.statuses || [];
          if (Array.isArray(callStatuses) && callStatuses.length > 0) {
            notifyServer("/admin/api/call", { kind: "statuses", value });
          }

          notifyServer("/admin/api/new-whatsapp");
          break;
        }
        default: {
          console.warn("Unhandled WhatsApp change field", (change as any).field);
        }
      }
    }
  }

  return new Response("OK", { status: 200 });
}

export default withErrorReporting(handler);
