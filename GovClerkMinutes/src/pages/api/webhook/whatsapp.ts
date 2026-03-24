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

  // Iterate through entries & changes similar to wati webhook structure.
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      switch (change.field) {
        case "messages": {
          // A single change can include inbound messages, statuses, or both.
          if (change.value.messages && change.value.messages.length > 0) {
            await handleWhatsappMessages(change);
          }
          if (change.value.statuses && change.value.statuses.length > 0) {
            await handleWhatsAppStatuses(change);
          }

          // Trigger websocket to notify clients of new message
          await fetch(serverUri("/admin/api/new-whatsapp"), {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.UPLOAD_COMPLETE_WEBHOOK_SECRET}`,
            },
          });
          break;
        }
        case "calls": {
          // Relay connect events and statuses to unified call endpoint
          const value = change.value;
          const hasCalls = Array.isArray(value?.calls) && value.calls.length > 0;
          if (hasCalls) {
            await fetch(serverUri("/admin/api/call"), {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${process.env.UPLOAD_COMPLETE_WEBHOOK_SECRET}`,
              },
              body: JSON.stringify({ kind: "calls", value }),
            });
          }

          const callStatuses = (value as any)?.statuses || [];
          const hasStatuses = Array.isArray(callStatuses) && callStatuses.length > 0;
          if (hasStatuses) {
            await fetch(serverUri("/admin/api/call"), {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${process.env.UPLOAD_COMPLETE_WEBHOOK_SECRET}`,
              },
              body: JSON.stringify({ kind: "statuses", value }),
            });
          }

          // Also notify generic WhatsApp event for consistency
          await fetch(serverUri("/admin/api/new-whatsapp"), {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.UPLOAD_COMPLETE_WEBHOOK_SECRET}`,
            },
          });

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
