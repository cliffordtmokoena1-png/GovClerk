import { ClerkEnvironment, getClerkKeysFromEnv } from "@/utils/clerk";
import type { Site } from "@/utils/site";

export type CreateUserParams = {
  email: string;
  firstName: string | null;
  env?: ClerkEnvironment;
  site?: Site;
};

export async function createUser({
  email,
  firstName,
  env,
  site,
}: CreateUserParams): Promise<string> {
  const keys = getClerkKeysFromEnv(env, site);

  if (!keys?.secretKey) {
    throw new Error(`[createUser] No Clerk secret key found for env=${env}, site=${site}`);
  }

  try {
    const res = await fetch("https://api.clerk.com/v1/users", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${keys.secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email_address: [email],
        first_name: firstName,
        skip_password_requirement: true,
        public_metadata: {
          skip_welcome_email: true,
        },
      }),
    }).then((r) => r.json());

    if (res.id == null) {
      throw new Error(`Failed to create user for email: ${email} res: ${JSON.stringify(res)}`);
    }

    return res.id;
  } catch (error) {
    console.error(`[createUser] Error creating user for email=${email}:`, error);
    throw error;
  }
}
