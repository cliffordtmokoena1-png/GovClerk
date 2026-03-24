import { assertString } from "@/utils/assert";

export type CreateEmailParams = {
  direction: "INCOMING" | "OUTGOING";
  subject: string; // Email subject
  senderAddress: string;
  senderName?: string;
  receiverAddress: string;
  receiverName?: string;
  text: string; // Email body in plain text
  html: string; // Email body in HTML
  timestamp: string; // ISO 8601 format
  ownerId?: string;
};
export async function createEmail({
  direction,
  subject,
  senderAddress,
  senderName,
  receiverAddress,
  receiverName,
  text,
  html,
  timestamp,
  ownerId,
}: CreateEmailParams): Promise<string> {
  const response = await fetch("https://api.hubapi.com/crm/v3/objects/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${assertString(process.env.HUBSPOT_ACCESS_TOKEN)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties: {
        hs_timestamp: timestamp,
        hs_email_direction: direction === "OUTGOING" ? "EMAIL" : "INCOMING_EMAIL",
        hs_email_subject: subject,
        hs_email_text: text,
        hs_email_html: html,
        hs_email_headers: JSON.stringify({
          from: {
            email: senderAddress,
            ...(senderName && { firstName: senderName }),
          },
          to: [
            {
              email: receiverAddress,
              ...(receiverName && { firstName: receiverName }),
            },
          ],
        }),
        ...(ownerId && { hubspot_owner_id: ownerId }),
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`HubSpot API error: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();

  return data.id;
}
