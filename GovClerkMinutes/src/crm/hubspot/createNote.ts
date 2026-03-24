import { assertString } from "@/utils/assert";

export type CreateNoteParams = {
  noteBody: string;
  timestamp: string; // ISO 8601 format
  ownerId?: string;
};

export async function createNote({
  noteBody,
  timestamp,
  ownerId,
}: CreateNoteParams): Promise<string> {
  const response = await fetch("https://api.hubapi.com/crm/v3/objects/notes", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${assertString(process.env.HUBSPOT_ACCESS_TOKEN)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties: {
        hs_timestamp: timestamp,
        hs_note_body: noteBody,
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
