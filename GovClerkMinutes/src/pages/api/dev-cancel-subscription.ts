import { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import withErrorReporting from "@/error/withErrorReporting";
import { isDev } from "@/utils/dev";

/**
 * @deprecated Stripe dev subscription cancellation — disabled during PayStack migration.
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!isDev()) {
    return res.status(403).json({ error: "Only available in development" });
  }

  const { userId } = getAuth(req);
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  return res.status(503).json({
    error: "Subscription management is being migrated to PayStack. Please try again shortly.",
  });
}

export default withErrorReporting(handler);
