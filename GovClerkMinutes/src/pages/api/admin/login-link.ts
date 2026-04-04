import type { NextApiRequest, NextApiResponse } from "next";

import withErrorReporting from "@/error/withErrorReporting";
import { withServiceAccountOrAdminAuth } from "@/utils/serviceAccountAuth";
import { sendSignInMagicEmail, sendSignUpMagicEmail } from "@/utils/postmark";
import { createSignInToken } from "@/utils/clerk";
import { getUserIdFromEmail } from "@/auth/getUserIdFromEmail";
import { createUser } from "@/auth/createUser";
import { getSiteFromHeaders } from "@/utils/site";

type LoginLinkResponse = {
  emailSent: boolean;
  isExistingUser: boolean;
  email: string;
};

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<LoginLinkResponse | { error: string }>
) {
  const persona = req.headers["x-service-account-persona"];
  if (persona) {
    console.log(`[admin/login-link] Called by service account: ${persona}`);
  }

  const { email } = req.body;
  const env = "prod";

  if (!email || !email.includes("@")) {
    return res.status(400).json({ error: "Valid email address required" });
  }

  try {
    const site = getSiteFromHeaders(req.headers);
    const userIdFromEmail = await getUserIdFromEmail({
      email,
      env,
      site,
    });

    const userExists = userIdFromEmail !== null;

    if (userExists && userIdFromEmail) {
      const token = await createSignInToken(userIdFromEmail, site);
      if (!token) {
        throw new Error(`Failed to create Clerk sign-in token for userId=${userIdFromEmail}`);
      }
      await sendSignInMagicEmail(email, token);
    } else {
      const newUserId = await createUser({
        email,
        firstName: null,
        env,
        site,
      });
      const token = await createSignInToken(newUserId, site);
      if (!token) {
        throw new Error(`Failed to create Clerk sign-in token for userId=${newUserId}`);
      }
      await sendSignUpMagicEmail(email, token);
    }

    return res.status(200).json({
      emailSent: true,
      isExistingUser: userExists,
      email,
    });
  } catch (error) {
    console.error("[admin/login-link] Handler error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return res.status(500).json({ error: message });
  }
}

export default withErrorReporting(withServiceAccountOrAdminAuth(handler));
