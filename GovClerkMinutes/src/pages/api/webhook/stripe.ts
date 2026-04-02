import { NextApiRequest, NextApiResponse } from "next";
import withErrorReporting from "@/error/withErrorReporting";

export const config = {
  api: {
    bodyParser: false,
  },
};

/**
 * @deprecated Stripe webhook endpoint — disabled during PayStack migration.
 * PayStack webhook handling will be implemented in Phase 3.
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
  return res
    .status(410)
    .json({ error: "Stripe payment processing has been discontinued. Please use PayStack." });
}

export default withErrorReporting(handler);
