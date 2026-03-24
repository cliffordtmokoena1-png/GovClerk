import { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import getPrimaryEmail from "@/utils/email";
import withErrorReporting from "@/error/withErrorReporting";
import { getSiteFromHeaders } from "@/utils/site";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { userId } = getAuth(req);
    if (userId == null) {
      res.status(401).json({});
      return;
    }

    const site = getSiteFromHeaders(req.headers);
    const email = await getPrimaryEmail(userId, site);

    if (email == null) {
      return res.status(400).json({ error: "Bad request" });
    }

    return res.status(200).json({ email });
  } catch (err) {
    console.error("[api/get-email] Unexpected error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export default withErrorReporting(handler);
