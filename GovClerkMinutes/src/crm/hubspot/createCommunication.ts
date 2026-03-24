import { assertString } from "@/utils/assert";

export type CreateCommunicationParams = {
  channel: "WHATS_APP";
  body: string;
  timestamp: Date;
  ownerId?: string;
};

export async function createCommunication({
  channel,
  body,
  timestamp,
  ownerId,
}: CreateCommunicationParams): Promise<string> {
  const response = await fetch("https://api.hubapi.com/crm/v3/objects/communications", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${assertString(process.env.HUBSPOT_ACCESS_TOKEN)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties: {
        hs_communication_channel_type: channel,
        hs_communication_logged_from: "CRM",
        hs_communication_body: body,
        hs_timestamp: timestamp.toISOString(),
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
