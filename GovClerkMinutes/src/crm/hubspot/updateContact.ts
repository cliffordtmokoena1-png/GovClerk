import { assertString } from "@/utils/assert";
import { MgLead } from "../leads";
import { getContact } from "./getContact";
import { ContactFilter } from "./types";
import { formatDueDate } from "./utils";

export type UpdateContactParams = {
  filter: ContactFilter;
  properties: Partial<MgLead>;
};
export async function updateContact({
  filter,
  properties: {
    email,
    firstName,
    phone,
    minutesFreq,
    minutesDue,
    userId,
    instantlyId,
    occupation,
    organizationName,
  },
}: UpdateContactParams): Promise<void> {
  const contact = await getContact({
    filter,
  });

  if (!contact) {
    return;
  }

  const response = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${contact.id}`, {
    method: "PATCH",
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
        ...(occupation && { jobtitle: occupation }),
        ...(organizationName && { company: organizationName }),
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`HubSpot API error: ${response.status} ${await response.text()}`);
  }
}
