import { WhatsappWebhook } from "@/admin/whatsapp/types";
import { serializeCallPermissionReplyText } from "@/admin/whatsapp/messages";
import { capture, WHATSAPP_WEBHOOK_ANONYMOUS_ID } from "@/utils/posthog";
import { connect } from "@planetscale/database";
import { makeConversationId } from "@/admin/whatsapp/utils";
import { getLeadByPhoneFromDb } from "@/crm/leads";
import whatsapp from "@/admin/whatsapp/api";
import get_presigned_url from "@/s3/get_presigned_url";
import { assertString } from "@/utils/assert";
import requestSendPush from "@/push/requestSendPush";
import mimeDb from "mime-db";
import { handleAiAutoReply } from "@/ai-agent/whatsappAutoReply";

export async function handleWhatsappMessages(change: WhatsappWebhook.MessagesChange) {
  const value = change.value;
  const messages = value.messages ?? [];
  if (messages.length === 0) {
    return;
  }

  const businessWaId = value.metadata.display_phone_number;

  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  for (const msg of messages) {
    const contactWaId = msg.from.replace(/[^0-9]/g, "");
    const conversationId = makeConversationId(businessWaId, contactWaId);
    const direction = "inbound";
    const displayName =
      value.contacts?.find((c: WhatsappWebhook.Contact) => c.wa_id === contactWaId)?.profile
        ?.name ?? null;

    const lead = await getLeadByPhoneFromDb(`+${contactWaId}`);
    const userId = lead?.userId ?? null;

    await conn.execute(
      `
      INSERT INTO gc_whatsapp_contacts (whatsapp_id, name, user_id, source)
      VALUES (?, ?, ?, 'whatsapp')
      ON DUPLICATE KEY UPDATE
        name = IF(name IS NULL, VALUES(name), name),
        user_id = IF(user_id IS NULL AND VALUES(user_id) IS NOT NULL, VALUES(user_id), user_id),
        source = 'whatsapp'
      `,
      [contactWaId, displayName, userId]
    );

    switch (msg.type) {
      case "text": {
        await conn.execute(
          `
          INSERT INTO gc_whatsapps
          (created_at, operator_email, sender, whatsapp_id, business_whatsapp_id, conversation_id, message_id, type, text, direction, source)
          VALUES (NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, 'whatsapp')
          `,
          [
            businessWaId,
            displayName,
            contactWaId,
            businessWaId,
            conversationId,
            msg.id,
            msg.type,
            msg.text.body,
            direction,
          ]
        );

        // Notify admins via server-side push API (Node runtime)
        await requestSendPush({
          title: lead?.firstName ?? "GovClerkMinutes",
          body: msg.text.body,
          url: "/admin/whatsapp",
          tag: "mg-whatsapp",
        });

        // Trigger AI agent auto-reply (awaited so Edge Runtime doesn't kill it)
        try {
          await handleAiAutoReply({
            contactWaId,
            businessWaId: businessWaId,
            inboundText: msg.text.body,
            userId,
          });
        } catch (err) {
          console.error("[ai-agent] Unhandled auto-reply error:", err);
        }

        break;
      }
      case "interactive": {
        // Currently we only handle call_permission_reply
        const interactive = (msg as WhatsappWebhook.InteractiveMessage).interactive;
        if (interactive?.type === "call_permission_reply" && interactive.call_permission_reply) {
          const reply = interactive.call_permission_reply;
          const ctxId = (msg as WhatsappWebhook.InteractiveMessage).context?.id ?? null;

          // Store a structured JSON payload in text with a version for forward compatibility
          const text = serializeCallPermissionReplyText({
            v: 1,
            type: "call_permission_reply",
            response: reply.response,
            is_permanent: reply.is_permanent ?? null,
            expiration_timestamp: reply.expiration_timestamp ?? null,
            response_source: reply.response_source ?? null,
            context_id: ctxId,
          });

          await conn.execute(
            `
            INSERT INTO gc_whatsapps
            (created_at, operator_email, sender, whatsapp_id, business_whatsapp_id, conversation_id, message_id, type, text, direction, source)
            VALUES (NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, 'whatsapp')
            `,
            [
              businessWaId,
              displayName,
              contactWaId,
              businessWaId,
              conversationId,
              msg.id,
              "interactive_call_permission_reply",
              text,
              direction,
            ]
          );

          await requestSendPush({
            title: lead?.firstName ?? "GovClerkMinutes",
            body: `Call permission: ${reply.response}`,
            url: "/admin/whatsapp",
            tag: "mg-whatsapp",
          });
        } else {
          console.warn("Unhandled WhatsApp interactive message", msg);
        }
        break;
      }
      case "audio": {
        const { url, mime_type } = await whatsapp.getMediaUrl({ mediaId: msg.audio.id });

        const mimeInfo = mimeDb[mime_type];
        let ext = mimeInfo?.extensions?.[0];
        if (ext) {
          ext = `.${ext}`;
        }
        const key = `audio/${msg.id}${ext}`;

        const [{ data }, { presignedUrl }] = await Promise.all([
          whatsapp.downloadMedia({
            mediaUrl: url,
          }),
          get_presigned_url({
            key,
            bucket: "GovClerkMinuteswhatsapp",
            region: "us-east-1",
            method: "PUT",
            expiresInSecs: 600,
            accessKeyId: assertString(process.env.AWS_WHATSAPP_ACCESS_KEY),
            secretAccessKey: assertString(process.env.AWS_WHATSAPP_ACCESS_KEY_SECRET),
          }),
        ]);

        const res = await fetch(presignedUrl, {
          method: "PUT",
          body: data,
        });

        if (!res.ok) {
          const err = await res.text();
          console.error("Failed to upload WhatsApp audio to S3", err);
          await capture(
            "whatsapp_inbound_error",
            {
              err,
              msg_id: msg.id,
            },
            userId ?? WHATSAPP_WEBHOOK_ANONYMOUS_ID
          );
        }

        await conn.execute(
          `
          INSERT INTO gc_whatsapps
          (created_at, operator_email, sender, whatsapp_id, business_whatsapp_id, conversation_id, message_id, type, text, direction, source)
          VALUES (NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, 'whatsapp')
          `,
          [
            businessWaId,
            displayName,
            contactWaId,
            businessWaId,
            conversationId,
            msg.id,
            msg.type,
            key,
            direction,
          ]
        );

        await requestSendPush({
          title: lead?.firstName ?? "GovClerkMinutes",
          body: "Audio message",
          url: "/admin/whatsapp",
          tag: "mg-whatsapp",
        });

        break;
      }
      default: {
        console.warn("Unhandled WhatsApp message type", msg);
      }
    }

    await conn.execute(
      `
      UPDATE gc_scheduled_whatsapps
      SET is_sent = 2
      WHERE whatsapp_id = ?
        AND is_sent = 0
        AND cancel_on_reply = 1
      `,
      [contactWaId]
    );

    await capture(
      "whatsapp_inbound",
      {
        from: contactWaId,
        msg_id: msg.id,
        name: displayName,
      },
      userId ?? WHATSAPP_WEBHOOK_ANONYMOUS_ID
    );
  }
}

// Handle status updates (sent, delivered, read, failed) for previously sent outbound messages.
// For now we only capture analytics events. If we later want to persist delivery/read timestamps,
// we can add columns (e.g., delivered_at, read_at, status) to gc_whatsapps and update here.
export async function handleWhatsAppStatuses(change: WhatsappWebhook.MessagesChange) {
  const value = change.value;
  const statuses = value.statuses ?? [];

  for (const status of statuses) {
    await capture(
      "whatsapp_outgoing_status",
      {
        status: status,
      },
      WHATSAPP_WEBHOOK_ANONYMOUS_ID
    );

    const conn = connect({
      host: process.env.PLANETSCALE_DB_HOST,
      username: process.env.PLANETSCALE_DB_USERNAME,
      password: process.env.PLANETSCALE_DB_PASSWORD,
    });

    switch (status.status) {
      case "sent":
      case "delivered":
      case "read":
        await conn.execute(
          `
          UPDATE gc_whatsapps
          SET ${status.status}_at = FROM_UNIXTIME(?)
          WHERE message_id = ?
          `,
          [status.timestamp, status.id]
        );
    }

    if (status.errors && status.errors.length > 0) {
      await conn.execute(
        `
        UPDATE gc_whatsapps
        SET error = ?
        WHERE message_id = ?
        `,
        [status.errors[0].code, status.id]
      );

      await capture(
        "whatsapp_outgoing_status_error",
        {
          message_id: status.id,
          status: status,
        },
        WHATSAPP_WEBHOOK_ANONYMOUS_ID
      );
    }
  }
}
