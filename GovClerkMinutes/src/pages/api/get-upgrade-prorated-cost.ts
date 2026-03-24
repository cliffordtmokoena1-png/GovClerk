import { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import withErrorReporting from "@/error/withErrorReporting";

/**
 * @deprecated Stripe prorated cost calculation — disabled during PayStack migration.
 * PayStack plan management will be implemented in Phase 3.
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { userId } = getAuth(req);
  if (userId == null) {
    res.status(401).end();
    return;
  }

  return res.status(503).json({
    error: "Plan upgrade cost calculation is being migrated to PayStack. Please try again shortly.",
  });
}

export default withErrorReporting(handler);
