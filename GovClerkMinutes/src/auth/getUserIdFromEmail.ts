import { ClerkEnvironment, getClerkKeysFromEnv } from "@/utils/clerk";
import type { Site } from "@/utils/site";

export type GetUserIdFromEmailParams = {
  email: string;
  env?: ClerkEnvironment;
  site?: Site;
};

export async function getUserIdFromEmail({
  email,
  env,
  site,
}: GetUserIdFromEmailParams): Promise<string | null> {
  try {
    const keys = getClerkKeysFromEnv(env, site);
    if (!keys?.secretKey) {
      console.error(`[getUserIdFromEmail] Configuration error: missing Clerk secret key for env=${env}, site=${site}`);
      return null;
    }

    const response = await fetch(
      `https://api.clerk.com/v1/users?email_address=${encodeURIComponent(email)}`,
      {
        headers: {
          Authorization: `Bearer ${keys.secretKey}`,
        },
      }
    );

    if (!response.ok) {
      console.error(`[getUserIdFromEmail] Clerk API error: ${response.status}`);
      return null;
    }

    const res = await response.json();

    if (!Array.isArray(res) || res.length === 0) {
      return null;
    }

    const id = res[0].id;
    return typeof id === "string" ? id : null;
  } catch (error) {
    console.error(`[getUserIdFromEmail] Error looking up ${email}:`, error);
    return null;
  }
}
