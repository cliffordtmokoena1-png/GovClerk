import { assertString } from "@/utils/assert";
import { WHATSAPP_API_VERSION, getPhoneNumberIdFor } from "./consts";
import { connect } from "@planetscale/database";
import getPrimaryEmail from "@/utils/email";
import { makeConversationId } from "../utils";

export interface WriteMessageToDbParams {
  adminUserId: string;
  businessWhatsappId: string;
  whatsappId: string;
  messageId: string;
  text: string;
  type: string;
}
export async function writeMessageToDb({
  adminUserId,
  businessWhatsappId,
  whatsappId,
  messageId,
  text,
  type,
}: WriteMessageToDbParams): Promise<void> {
  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  const operatorEmail = await getPrimaryEmail(adminUserId);
  // Conversation is between the business number and the recipient
  const conversationId = makeConversationId(businessWhatsappId, whatsappId);

  await Promise.all([
    conn.execute(
      `
      INSERT INTO gc_whatsapps
  (created_at, operator_email, sender, whatsapp_id, business_whatsapp_id, conversation_id, message_id, type, \`text\`, direction, source)
      VALUES (NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        operatorEmail,
        operatorEmail,
        whatsappId,
        businessWhatsappId,
        conversationId,
        messageId,
        type,
        text,
        "outbound",
        "whatsapp",
      ]
    ),
    conn.execute(
      `
      INSERT INTO gc_whatsapp_reads (conversation_id, user_id, last_read_at)
      VALUES (?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        last_read_at = NOW();
      `,
      [conversationId, adminUserId]
    ),
  ]);
}

export interface TextMessageParams {
  type: "text";
  adminUserId: string;
  businessWhatsappId: string;
  to: string;
  body: string;
  previewUrl?: boolean;
}

export interface CallPermissionRequestMessageParams {
  type: "call_permission_request";
  adminUserId: string;
  businessWhatsappId: string;
  to: string;
  body: string;
}

export type MessageParams = TextMessageParams | CallPermissionRequestMessageParams; // | ImageMessageParams | TemplateMessageParams ...

export interface MessageResponse {
  messaging_product: string;
  contacts?: Array<{ input: string; wa_id: string }>;
  messages?: Array<{ id: string }>;
  raw: any;
}

async function sendTextMessage(params: TextMessageParams): Promise<MessageResponse> {
  const phoneNumberId = getPhoneNumberIdFor(params.businessWhatsappId);
  const url = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${phoneNumberId}/messages`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${assertString(process.env.META_WHATSAPP_BUSINESS_API_KEY)}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      type: "text",
      to: params.to,
      text: {
        preview_url: params.previewUrl ?? false,
        body: params.body,
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to send text message: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();

  return {
    messaging_product: data.messaging_product,
    contacts: data.contacts,
    messages: data.messages,
    raw: data,
  };
}

async function sendCallPermissionRequest(
  params: CallPermissionRequestMessageParams
): Promise<MessageResponse> {
  const phoneNumberId = getPhoneNumberIdFor(params.businessWhatsappId);
  const url = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${phoneNumberId}/messages`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${assertString(process.env.META_WHATSAPP_BUSINESS_API_KEY)}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: params.to,
      type: "interactive",
      interactive: {
        type: "call_permission_request",
        action: { name: "call_permission_request" },
        body: { text: params.body },
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to send call permission request: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();

  return {
    messaging_product: data.messaging_product,
    contacts: data.contacts,
    messages: data.messages,
    raw: data,
  };
}

export async function sendMessage(params: MessageParams): Promise<MessageResponse> {
  switch (params.type) {
    case "text":
      const res = await sendTextMessage(params);
      await writeMessageToDb({
        adminUserId: params.adminUserId,
        businessWhatsappId: params.businessWhatsappId,
        whatsappId: params.to,
        messageId: res.messages?.[0]?.id ?? "",
        text: params.body,
        type: "text",
      });
      return res;
    case "call_permission_request":
      const res2 = await sendCallPermissionRequest(params);
      await writeMessageToDb({
        adminUserId: params.adminUserId,
        businessWhatsappId: params.businessWhatsappId,
        whatsappId: params.to,
        messageId: res2.messages?.[0]?.id ?? "",
        text: params.body,
        type: "call_permission_request",
      });
      return res2;
    default:
      // @ts-expect-error - exhaustive check
      throw new Error(`Unsupported message type: ${params.type}`);
  }
}
