import { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import withErrorReporting from "@/error/withErrorReporting";

/**
 * @deprecated Stripe invoice download — disabled during PayStack migration.
 * PayStack invoice handling will be implemented in Phase 3.
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { userId } = getAuth(req);
  if (userId == null) {
    res.status(401).json({});
    return;
  }

  return res.status(503).json({
    error: "Invoice downloads are being migrated to PayStack. Please try again shortly.",
  });
}

export default withErrorReporting(handler);
