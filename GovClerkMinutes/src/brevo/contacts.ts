import { getLeadFromDb } from "@/crm/leads";
import type { BrevoListId } from "./lists";

const BREVO_BASE_URL = "https://api.brevo.com/v3";

function brevoHeaders() {
  return {
    "Content-Type": "application/json",
    "api-key": process.env.BREVO_API_KEY ?? "",
  };
}

export type CreateOrUpdateContactParams = {
  email: string;
  listIds?: BrevoListId[];
  attributes?: Record<string, any>;
};

export async function createOrUpdateContact({
  email,
  listIds,
  attributes,
}: CreateOrUpdateContactParams): Promise<any> {
  const body: Record<string, any> = {
    email,
    updateEnabled: true,
  };
  if (attributes && Object.keys(attributes).length > 0) {
    body.attributes = attributes;
  }
  if (listIds && listIds.length > 0) {
    body.listIds = listIds;
  }

  return await fetch(`${BREVO_BASE_URL}/contacts`, {
    method: "POST",
    headers: brevoHeaders(),
    body: JSON.stringify(body),
  }).then((r) => r.json());
}

export async function getContactByEmail(email: string): Promise<any> {
  const res = await fetch(`${BREVO_BASE_URL}/contacts/${encodeURIComponent(email)}`, {
    method: "GET",
    headers: brevoHeaders(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch Brevo contact ${email}: ${res.status} ${text}`);
  }

  return res.json();
}

export async function updateContact(
  email: string,
  params: { attributes?: Record<string, any>; listIds?: BrevoListId[] }
): Promise<void> {
  const body: Record<string, any> = {};
  if (params.attributes && Object.keys(params.attributes).length > 0) {
    body.attributes = params.attributes;
  }
  if (params.listIds && params.listIds.length > 0) {
    body.listIds = params.listIds;
  }

  const res = await fetch(`${BREVO_BASE_URL}/contacts/${encodeURIComponent(email)}`, {
    method: "PUT",
    headers: brevoHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to update Brevo contact ${email}: ${res.status} - ${text}`);
  }
}

export async function deleteContact(userId: string): Promise<void> {
  const lead = await getLeadFromDb(userId);
  if (lead == null) {
    return;
  }

  const res = await fetch(`${BREVO_BASE_URL}/contacts/${encodeURIComponent(lead.email)}`, {
    method: "DELETE",
    headers: brevoHeaders(),
  });

  // eslint-disable-next-line no-console
  console.log("Delete Brevo contact response", res.status);
}

export async function addContactToList(email: string, listId: BrevoListId): Promise<void> {
  const res = await fetch(`${BREVO_BASE_URL}/contacts/lists/${listId}/contacts/add`, {
    method: "POST",
    headers: brevoHeaders(),
    body: JSON.stringify({ emails: [email] }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to add contact to Brevo list ${listId}: ${res.status} ${text}`);
  }
}

export async function removeContactFromList(email: string, listId: BrevoListId): Promise<void> {
  const res = await fetch(`${BREVO_BASE_URL}/contacts/lists/${listId}/contacts/remove`, {
    method: "POST",
    headers: brevoHeaders(),
    body: JSON.stringify({ emails: [email] }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to remove contact from Brevo list ${listId}: ${res.status} ${text}`);
  }
}

export async function getContactsFromList<T>(listId: BrevoListId): Promise<T[]> {
  let allContacts: T[] = [];
  let offset = 0;
  const limit = 500;

  while (true) {
    const url = new URL(`${BREVO_BASE_URL}/contacts/lists/${listId}/contacts`);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("offset", String(offset));

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: brevoHeaders(),
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Failed to fetch contacts from Brevo list ${listId}: ${res.status} ${error}`);
    }

    const data = await res.json();
    const contacts: T[] = Array.isArray(data.contacts) ? data.contacts : [];
    allContacts = allContacts.concat(contacts);

    if (contacts.length < limit) {
      break;
    }
    offset += limit;
  }

  return allContacts;
}
