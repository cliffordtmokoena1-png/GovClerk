import type { NextApiRequest, NextApiResponse } from "next";
import { sendSlackWebhook } from "@/utils/slack";

type ConversationStatus = "open" | "pending" | "resolved";
type ConversationTag = "[Support]" | "[Sales]";

interface WhatsAppSlackWebhookBody {
  /** WhatsApp phone number of the sender */
  from: string;
  /** Display name of the sender (if available) */
  senderName?: string;
  /** The message text */
  message: string;
  /** Conversation status */
  status?: ConversationStatus;
  /** Tag for conversation routing */
  tag?: ConversationTag;
  /** User email (if known) */
  email?: string;
  /** User plan name (if known) */
  planName?: string;
}

const TAG_COLORS: Record<ConversationTag, string> = {
  "[Support]": "#3B82F6",
  "[Sales]": "#10B981",
};

const STATUS_EMOJI: Record<ConversationStatus, string> = {
  open: "🟢",
  pending: "🟡",
  resolved: "✅",
};

const VALID_STATUSES: ConversationStatus[] = ["open", "pending", "resolved"];
const VALID_TAGS: ConversationTag[] = ["[Support]", "[Sales]"];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const webhookSecret = process.env.WHATSAPP_SLACK_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("WHATSAPP_SLACK_WEBHOOK_SECRET is not configured");
    return res.status(500).json({ error: "Webhook not configured" });
  }

  const providedSecret = req.headers["x-webhook-secret"];
  if (providedSecret !== webhookSecret) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const body = req.body;

  if (!body || typeof body.from !== "string" || typeof body.message !== "string") {
    return res.status(400).json({ error: "Missing required fields: from, message" });
  }

  const from: string = body.from;
  const message: string = body.message;
  const senderName = typeof body.senderName === "string" ? body.senderName : undefined;
  const email = typeof body.email === "string" ? body.email : undefined;
  const planName = typeof body.planName === "string" ? body.planName : undefined;

  const status: ConversationStatus =
    typeof body.status === "string" && VALID_STATUSES.includes(body.status as ConversationStatus)
      ? (body.status as ConversationStatus)
      : "open";
  const tag: ConversationTag =
    typeof body.tag === "string" && VALID_TAGS.includes(body.tag as ConversationTag)
      ? (body.tag as ConversationTag)
      : "[Support]";

  const statusEmoji = STATUS_EMOJI[status];
  const color = TAG_COLORS[tag];

  const fields = [
    { title: "From", value: senderName ? `${senderName} (${from})` : from, short: true },
    { title: "Status", value: `${statusEmoji} ${status}`, short: true },
    ...(email ? [{ title: "Email", value: email, short: true }] : []),
    ...(planName ? [{ title: "Plan", value: planName, short: true }] : []),
    { title: "Message", value: message, short: false },
  ];

  try {
    await sendSlackWebhook([
      {
        color,
        title: `${tag} WhatsApp Message`,
        fields,
        footer: `WhatsApp • ${new Date().toISOString()}`,
      },
    ]);

    return res.status(200).json({ success: true, status, tag });
  } catch (error) {
    console.error("Failed to forward WhatsApp message to Slack:", error);
    return res.status(500).json({ error: "Failed to forward message to Slack" });
  }
}
