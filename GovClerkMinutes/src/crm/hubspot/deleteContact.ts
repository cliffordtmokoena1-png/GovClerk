import { assertString } from "@/utils/assert";

export type DeleteContactParams = {
  contactId: string;
};
export async function deleteContact({ contactId }: DeleteContactParams): Promise<void> {
  const response = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${assertString(process.env.HUBSPOT_ACCESS_TOKEN)}`,
    },
  });

  if (!response.ok) {
    throw new Error(`HubSpot API error: ${response.status} ${await response.text()}`);
  }
}
