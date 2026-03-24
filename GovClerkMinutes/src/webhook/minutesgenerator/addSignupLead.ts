import { Connection } from "@planetscale/database";
import { createLead } from "@/instantly/leads";
import { CAMPAIGNS } from "@/instantly/campaigns";
import { createAuthToken } from "@/auth/createAuthToken";
import hubspot from "@/crm/hubspot";
import { PostSignupLead } from "./runPostSignupTasks";

export async function addSignupLead(lead: PostSignupLead, conn: Connection): Promise<string> {
  // eslint-disable-next-line no-console
  console.log(`Adding lead to ${lead.campaign} campaign: ${lead.email}`);

  const signInToken = await createAuthToken(lead.user_id);
  const variables: Record<string, string> = { signInToken };
  if (lead.minutes_freq) {
    variables["minutesFreq"] = lead.minutes_freq;
  }
  if (lead.minutes_due) {
    variables["minutesDue"] = lead.minutes_due;
  }

  const instantlyResponse = await createLead({
    email: lead.email,
    campaign: CAMPAIGNS.SIGNUP_URGENT,
    firstName: lead.first_name,
    phone: lead.phone,
    customVariables: variables,
  });

  await conn.execute("UPDATE gc_leads SET instantly_id = ? WHERE user_id = ?", [
    instantlyResponse.id,
    lead.user_id,
  ]);

  await hubspot.updateContact({
    filter: { propertyName: "user_id", value: lead.user_id },
    properties: {
      instantlyId: instantlyResponse.id,
    },
  });

  // eslint-disable-next-line no-console
  console.log(`Added lead to instantly: ${lead.email} (ID: ${instantlyResponse.id})`);

  return instantlyResponse.id;
}
