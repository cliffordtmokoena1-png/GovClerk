import { processMessage, detectPersonaFromHistory } from "@/ai-agent/conversation";
import { capture, WHATSAPP_WEBHOOK_ANONYMOUS_ID } from "@/utils/posthog";
import { connect } from "@planetscale/database";
import { makeConversationId } from "@/admin/whatsapp/utils";
import { WHATSAPP_API_VERSION, getPhoneNumberIdFor } from "@/admin/whatsapp/api/consts";
import { assertString } from "@/utils/assert";
import type { AgentMessage } from "@/ai-agent/types";

/** Operator email marker used for AI-generated outbound messages. */
const AI_AGENT_OPERATOR = "ai-agent";

/**
 * Send an AI-generated auto-reply to an inbound WhatsApp text message.
 *
 * This function:
 * 1. Loads recent conversation history for context.
 * 2. Detects the active persona (Samantha or Gray) from history.
 * 3. Calls the AI agent to generate a response.
 * 4. Sends the reply via the WhatsApp Cloud API.
 * 5. Stores the outbound message in the database.
 * 6. Captures analytics events.
 *
 * It is designed to be called from the existing webhook handler
 * (`handleWhatsappMessages`) in a fire-and-forget fashion so the webhook
 * can return quickly.
 */
export async function handleAiAutoReply({
  contactWaId,
  businessWaId,
  inboundText,
  userId,
  isNewContact = false,
  contactDisplayName = null,
}: {
  contactWaId: string;
  businessWaId: string;
  inboundText: string;
  userId: string | null;
  isNewContact?: boolean;
  contactDisplayName?: string | null;
}): Promise<void> {
  // Check if AI auto-reply is enabled via environment variable
  if (process.env.AI_AGENT_ENABLED !== "true") {
    return;
  }

  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  const conversationId = makeConversationId(businessWaId, contactWaId);

  try {
    // Load recent conversation history for context (last 20 messages)
    const historyResult = await conn.execute(
      `SELECT text, direction
       FROM gc_whatsapps
       WHERE conversation_id = ?
       ORDER BY created_at DESC
       LIMIT 20`,
      [conversationId]
    );

    // Convert DB rows into AgentMessage format (reverse to chronological order)
    const history: AgentMessage[] = (historyResult.rows as Array<{ text: string; direction: string }>)
      .reverse()
      .map((row) => ({
        role: row.direction === "inbound" ? ("user" as const) : ("assistant" as const),
        content: row.text ?? "",
      }));

    // Detect the active persona from history so the correct system prompt is used
    const activePersona = detectPersonaFromHistory(history);

    // For brand-new WhatsApp contacts (no email on file), prepend a context hint so
    // the AI knows to greet them and ask for their email to complete their profile.
    if (isNewContact && history.length === 0) {
      const greeting = contactDisplayName
        ? `Hi ${contactDisplayName}! Welcome to GovClerkMinutes. I'm Samantha, your virtual assistant. To complete your account setup and get the most out of our service, could you please share your email address?`
        : `Hi! Welcome to GovClerkMinutes. I'm Samantha, your virtual assistant. To complete your account setup and get the most out of our service, could you please share your email address?`;
      history.push({ role: "assistant", content: greeting });
    }

    // Process the message through the AI agent
    const response = await processMessage(inboundText, history, activePersona);

    // Send the reply via WhatsApp Cloud API
    const phoneNumberId = getPhoneNumberIdFor(businessWaId);
    const url = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${phoneNumberId}/messages`;

    const sendRes = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${assertString(process.env.META_WHATSAPP_BUSINESS_API_KEY)}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        type: "text",
        to: contactWaId,
        text: {
          preview_url: false,
          body: response.reply,
        },
      }),
    });

    if (!sendRes.ok) {
      const errText = await sendRes.text();
      console.error("[ai-agent] Failed to send WhatsApp reply:", errText);
      await capture(
        "ai_agent_error",
        { error: errText, conversation_id: conversationId },
        userId ?? WHATSAPP_WEBHOOK_ANONYMOUS_ID
      );
      return;
    }

    const sendData = await sendRes.json();
    const messageId = sendData?.messages?.[0]?.id ?? "";

    // Store the AI reply in the database
    await conn.execute(
      `INSERT INTO gc_whatsapps
       (created_at, operator_email, sender, whatsapp_id, business_whatsapp_id, conversation_id, message_id, type, text, direction, source)
       VALUES (NOW(), ?, ?, ?, ?, ?, ?, 'text', ?, 'outbound', 'whatsapp')`,
      [
        AI_AGENT_OPERATOR,
        AI_AGENT_OPERATOR,
        contactWaId,
        businessWaId,
        conversationId,
        messageId,
        response.reply,
      ]
    );

    // Capture analytics
    await capture(
      "ai_agent_reply",
      {
        conversation_id: conversationId,
        intent: response.intent,
        confidence: response.confidence,
        escalated: response.shouldEscalate,
        persona: response.persona,
        escalated_to_sales: response.escalatedToSales ?? false,
      },
      userId ?? WHATSAPP_WEBHOOK_ANONYMOUS_ID
    );

    // If escalation is needed, capture a separate event
    if (response.shouldEscalate) {
      await capture(
        "ai_agent_escalation",
        {
          conversation_id: conversationId,
          intent: response.intent,
          contact: contactWaId,
          persona: response.persona,
        },
        userId ?? WHATSAPP_WEBHOOK_ANONYMOUS_ID
      );
    }

    // If Samantha handed off to Gray, capture a separate event
    if (response.escalatedToSales) {
      await capture(
        "ai_agent_sales_escalation",
        {
          conversation_id: conversationId,
          contact: contactWaId,
        },
        userId ?? WHATSAPP_WEBHOOK_ANONYMOUS_ID
      );
    }
  } catch (error) {
    console.error("[ai-agent] Auto-reply error:", error);
    await capture(
      "ai_agent_error",
      {
        error: error instanceof Error ? error.message : String(error),
        conversation_id: conversationId,
      },
      userId ?? WHATSAPP_WEBHOOK_ANONYMOUS_ID
    );
  }
}
