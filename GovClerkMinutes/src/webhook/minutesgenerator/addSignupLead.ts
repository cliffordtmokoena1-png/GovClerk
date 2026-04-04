import { Connection } from "@planetscale/database";
import { createOrUpdateContact } from "@/brevo/contacts";
import { BREVO_LISTS } from "@/brevo/lists";
import { createSignInToken } from "@/utils/clerk";
import { PostSignupLead } from "./runPostSignupTasks";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function addSignupLead(lead: PostSignupLead, _conn: Connection): Promise<string> {
  // eslint-disable-next-line no-console
  console.log(`Adding lead to ${lead.campaign} campaign: ${lead.email}`);

  const signInToken = await createSignInToken(lead.user_id);
  if (!signInToken) {
    throw new Error(
      `[addSignupLead] Failed to create Clerk sign-in token for userId=${lead.user_id}`
    );
  }
  const variables: Record<string, string> = { signInToken };
  if (lead.minutes_freq) {
    variables["minutesFreq"] = lead.minutes_freq;
  }
  if (lead.minutes_due) {
    variables["minutesDue"] = lead.minutes_due;
  }

  const attributes: Record<string, any> = {
    FIRSTNAME: lead.first_name,
    SMS: lead.phone,
    SIGN_IN_TOKEN: variables.signInToken,
  };
  if (variables.minutesFreq) {
    attributes.MINUTES_FREQ = variables.minutesFreq;
  }
  if (variables.minutesDue) {
    attributes.MINUTES_DUE = variables.minutesDue;
  }

  await createOrUpdateContact({
    email: lead.email,
    listIds: [BREVO_LISTS.SIGNUP_URGENT],
    attributes,
  });

  // eslint-disable-next-line no-console
  console.log(`Added contact to Brevo: ${lead.email}`);

  return lead.email;
}
