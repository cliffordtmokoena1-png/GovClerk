import { assertString } from "@/utils/assert";
import { HubspotObjectLabel } from "./types";

// Run `npm run hubspot -- labels fromType toType` to see ids if adding a new one.
const AssociationTypes = {
  contactToTask: 203,
  contactToEmail: 197,
  contactToCommunication: 82,
} as const;

export type AssociationLabelsResponse = {
  results: AssociationLabel[];
};

export type AssociationLabel = {
  category: string;
  typeId: number;
  label: string | null;
};

export async function getAssociationLabels(
  fromType: HubspotObjectLabel,
  toType: HubspotObjectLabel
): Promise<AssociationLabelsResponse> {
  const res = await fetch(
    `https://api.hubapi.com/crm/v4/associations/${fromType}/${toType}/labels`,
    {
      headers: {
        Authorization: `Bearer ${assertString(process.env.HUBSPOT_ACCESS_TOKEN)}`,
      },
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Get labels failed: ${res.status} ${res.statusText} - ${err}`);
  }

  const data = await res.json();

  // eslint-disable-next-line no-console
  console.log(data);

  return data;
}

async function associate(
  fromType: HubspotObjectLabel,
  fromId: string,
  toType: HubspotObjectLabel,
  toId: string,
  associationTypeId: number
): Promise<void> {
  const res = await fetch(
    `https://api.hubapi.com/crm/v4/objects/${fromType}/${fromId}/associations/${toType}/${toId}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${assertString(process.env.HUBSPOT_ACCESS_TOKEN)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        {
          associationCategory: "HUBSPOT_DEFINED",
          associationTypeId,
        },
      ]),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Association failed: ${res.status} ${res.statusText} - ${err}`);
  }
}

export type AssociateContactWithTaskParams = {
  contactId: string;
  taskId: string;
};

export async function associateContactWithTask({
  contactId,
  taskId,
}: AssociateContactWithTaskParams): Promise<void> {
  await associate("contacts", contactId, "tasks", taskId, AssociationTypes.contactToTask);
}

export type AssociateContactWithEmailParams = {
  contactId: string;
  emailId: string;
};

export async function associateContactWithEmail({
  contactId,
  emailId,
}: AssociateContactWithEmailParams): Promise<void> {
  await associate("contacts", contactId, "emails", emailId, AssociationTypes.contactToEmail);
}

export type AssociateContactWithCommunicationParams = {
  contactId: string;
  communicationId: string;
};

export async function associateContactWithCommunication({
  contactId,
  communicationId,
}: AssociateContactWithCommunicationParams): Promise<void> {
  await associate(
    "contacts",
    contactId,
    "communications",
    communicationId,
    AssociationTypes.contactToCommunication
  );
}
