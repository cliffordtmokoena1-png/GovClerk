import { getClerkKeys } from "./clerk";
import type { Site } from "./site";

export default async function getPrimaryEmail(userId: string, site?: Site): Promise<string | null> {
  try {
    const keys = getClerkKeys(site);
    if (!keys?.secretKey) {
      console.error(
        `[getPrimaryEmail] Missing Clerk secret key for site "${site ?? "GovClerkMinutes"}"`
      );
      return null;
    }

    const userRes = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
      headers: {
        Authorization: `Bearer ${keys.secretKey}`,
      },
    });

    if (!userRes.ok) {
      console.error(`Failed to fetch user from Clerk (userId=${userId}):`, userRes.status);
      return null;
    }

    const emailIdResponse = await userRes.json();

    const primaryEmailId = emailIdResponse?.primary_email_address_id;
    if (!primaryEmailId) {
      console.error("Failed to retrieve primary email ID");
      return null;
    }

    const emailRes = await fetch(`https://api.clerk.com/v1/email_addresses/${primaryEmailId}`, {
      headers: {
        Authorization: `Bearer ${keys.secretKey}`,
      },
    });

    if (!emailRes.ok) {
      console.error(
        `Failed to fetch email address from Clerk (emailId=${primaryEmailId}):`,
        emailRes.status
      );
      return null;
    }

    const emailResponse = await emailRes.json();

    const email = emailResponse?.email_address;

    if (!email) {
      console.error("Failed to retrieve email address");
      return null;
    }

    return email;
  } catch (err) {
    console.error("[getPrimaryEmail] Unexpected error:", err);
    return null;
  }
}
