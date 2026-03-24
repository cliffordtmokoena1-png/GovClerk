import { assertString } from "@/utils/assert";

export type HubspotOwner = {
  id: string;
  email: string;
  type: string;
  firstName: string;
  lastName: string;
  userId: number;
  userIdIncludingInactive: number;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
};

export type HubspotOwnersResponse = {
  results: HubspotOwner[];
};

export async function getOwners(): Promise<HubspotOwnersResponse | null> {
  const res = await fetch("https://api.hubapi.com/crm/v3/owners?limit=100&archived=false", {
    headers: { Authorization: `Bearer ${assertString(process.env.HUBSPOT_ACCESS_TOKEN)}` },
  });

  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`Failed to fetch owners: ${res.status} ${res.statusText} – ${msg}`);
  }

  const data = await res.json();

  return data;
}
