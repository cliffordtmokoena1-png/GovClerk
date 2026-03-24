import { getLeadFromDb } from "@/crm/leads";
import type { Campaign } from "./campaigns";

export type CreateLeadParams = {
  email: string;
  campaign?: Campaign;
  firstName?: string;
  phone?: string;
  ltInterestStatus?: number;
  customVariables?: Record<string, any>;
};

export async function createLead({
  email,
  campaign,
  firstName,
  phone,
  ltInterestStatus,
  customVariables,
}: CreateLeadParams): Promise<any> {
  return await fetch("https://api.instantly.ai/api/v2/leads", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.INSTANTLY_V2_KEY}`,
    },
    body: JSON.stringify({
      campaign,
      email,
      first_name: firstName,
      phone,
      lt_interest_status: ltInterestStatus,
      custom_variables: customVariables,
    }),
  }).then((r) => r.json());
}

export async function moveLead(userId: string, toCampaignId: Campaign): Promise<void> {
  const lead = await getLeadFromDb(userId);
  if (lead == null || lead.instantlyId == null) {
    return;
  }

  const instantlyLead = await getLeadByInstantlyId(lead.instantlyId);
  const campaign = instantlyLead?.campaign;

  await moveLeadByInstantlyId({
    instantlyId: lead.instantlyId,
    campaignId: campaign,
    toCampaignId,
  });
}

export type MoveLeadByInstantlyIdParams = {
  instantlyId: string;
  campaignId: Campaign;
  toCampaignId: Campaign;
};
export async function moveLeadByInstantlyId({
  instantlyId,
  campaignId,
  toCampaignId,
}: MoveLeadByInstantlyIdParams): Promise<void> {
  const res = await fetch("https://api.instantly.ai/api/v2/leads/move", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.INSTANTLY_V2_KEY}`,
    },
    body: JSON.stringify({
      ids: [instantlyId],
      campaign: campaignId,
      to_campaign_id: toCampaignId,
    }),
  }).then((r) => r.json());

  // eslint-disable-next-line no-console
  console.log("Move lead response", res);
}

export async function getLeadByInstantlyId(instantlyId: string): Promise<any> {
  const res = await fetch(`https://api.instantly.ai/api/v2/leads/${instantlyId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${process.env.INSTANTLY_V2_KEY}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch lead ${instantlyId}: ${res.status} ${text}`);
  }

  return res.json();
}

export async function deleteLead(userId: string): Promise<void> {
  const lead = await getLeadFromDb(userId);
  if (lead == null || lead.instantlyId == null) {
    return;
  }

  const res = await fetch(`https://api.instantly.ai/api/v2/leads/${lead.instantlyId}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.INSTANTLY_V2_KEY}`,
    },
  });

  // eslint-disable-next-line no-console
  console.log("Delete lead response", res);
}

export type UpdateLeadParams = {
  instantlyId: string;
  firstName?: string | null;
  phone?: string | null;
  customVariables?: Record<string, any>;
};

export async function updateLeadByInstantlyId({
  instantlyId,
  firstName,
  phone,
  customVariables,
}: UpdateLeadParams): Promise<void> {
  const body: Record<string, any> = {};
  if (firstName) {
    body.first_name = firstName;
  }
  if (phone) {
    body.phone = phone;
  }
  if (customVariables && Object.keys(customVariables).length > 0) {
    body.custom_variables = customVariables;
  }

  const res = await fetch(`https://api.instantly.ai/api/v2/leads/${instantlyId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.INSTANTLY_V2_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to patch instantly lead: ${res.status} - ${text}`);
  }
}

export enum InstantlyInterestValue {
  OUT_OF_OFFICE = 0,
  INTERESTED = 1,
  MEETING_BOOKED = 2,
  MEETING_COMPLETED = 3,
  CLOSED = 4,
  NOT_INTERESTED = -1,
  WRONG_PERSON = -2,
  LOST = -3,
}

export async function updateInterestStatus(
  userId: string,
  interest_value: InstantlyInterestValue
): Promise<void> {
  const lead = await getLeadFromDb(userId);
  if (lead == null) {
    return;
  }

  const res = await fetch("https://api.instantly.ai/api/v2/leads/update-interest-status", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.INSTANTLY_V2_KEY}`,
    },
    body: JSON.stringify({
      lead_email: lead.email,
      interest_value,
    }),
  }).then((r) => r.json());

  // eslint-disable-next-line no-console
  console.log("Update interest status response", res);
}

export async function getLeadsForCampaign<T>(campaignId: Campaign): Promise<T[]> {
  let allItems: T[] = [];
  let startingAfter: string | undefined = undefined;
  const limit = 100;

  while (true) {
    const body: Record<string, any> = {
      campaign: campaignId,
      limit,
    };
    if (startingAfter) {
      body.starting_after = startingAfter;
    }

    const res = await fetch("https://api.instantly.ai/api/v2/leads/list", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.INSTANTLY_V2_KEY}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Failed to fetch leads: ${res.status} ${error}`);
    }

    const data = await res.json();

    // eslint-disable-next-line no-console
    console.log("Leads list result", res);

    const items = Array.isArray(data.items) ? data.items : [];
    allItems = allItems.concat(items as T[]);

    if (items.length < limit || !data.next_starting_after) {
      break;
    }
    startingAfter = data.next_starting_after;
  }

  return allItems;
}
