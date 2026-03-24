import { MgLead } from "../leads";
import { assertString } from "@/utils/assert";
import { formatDueDate } from "./utils";
import { ExtraContactProperties } from "./types";

/// Creates contact in HubSpot CRM and returns the contact ID.
export async function createContact({
  userId,
  email,
  firstName,
  phone,
  minutesFreq,
  minutesDue,
  instantlyId,
  lead_source,
}: Partial<MgLead> & ExtraContactProperties): Promise<string> {
  const response = await fetch("https://api.hubapi.com/crm/v3/objects/contacts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${assertString(process.env.HUBSPOT_ACCESS_TOKEN)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties: {
        ...(email && { email }),
        ...(firstName && { firstname: firstName }),
        ...(phone && { phone }),
        ...(minutesFreq && { minutes_frequency: minutesFreq }),
        ...(minutesDue && { minutes_due: formatDueDate(minutesDue) }),
        ...(userId && { user_id: userId }),
        ...(instantlyId && { instantly_id: instantlyId }),
        ...(lead_source && { lead_source }),
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`HubSpot API error: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();

  return data.id;
}
