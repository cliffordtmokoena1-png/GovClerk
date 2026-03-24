import { getAuth } from "@clerk/nextjs/server";
import type { NextApiRequest, NextApiResponse } from "next";

import withErrorReporting from "@/error/withErrorReporting";
import { sendSignInMagicEmail, sendSignUpMagicEmail } from "@/utils/postmark";
import { createAuthToken } from "@/auth/createAuthToken";
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
  const { userId, sessionClaims } = getAuth(req);

  if (!userId || !sessionClaims?.metadata?.role || sessionClaims.metadata.role !== "admin") {
    return res.status(401).json({ error: "Unauthorized" });
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
      const token = await createAuthToken(userIdFromEmail);
      await sendSignInMagicEmail(email, token);
    } else {
      const newUserId = await createUser({
        email,
        firstName: null,
        env,
        site,
      });
      const token = await createAuthToken(newUserId);
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

export default withErrorReporting(handler);
