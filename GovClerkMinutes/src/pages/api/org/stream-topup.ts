import { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import { PORTAL_OVERAGE_RATES } from "@/utils/portalPaystack";
import { initializeTransaction } from "@/utils/paystack";
import withErrorReporting from "@/error/withErrorReporting";

type StreamTopupRequest = {
  hours: number;
  orgId: string;
};

type StreamTopupResponse = {
  url: string;
};

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<StreamTopupResponse | { error: string }>
) {
  if (req.method !== "POST") {return res.status(405).json({ error: "Method not allowed" });}

  const { userId, orgId: authOrgId } = getAuth(req);
  if (!userId) {return res.status(401).json({ error: "Unauthorized" });}

  const { hours, orgId } = req.body as StreamTopupRequest;

  if (!hours || hours <= 0 || !orgId) {
    return res.status(400).json({ error: "Invalid request: hours and orgId are required" });
  }

  // Ensure org context matches
  if (orgId !== authOrgId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const amountZar = hours * PORTAL_OVERAGE_RATES.stream_hour_zar;
  // PayStack uses smallest currency unit (cents)
  const amountCents = amountZar * 100;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://govclerkminutes.com";

  const result = await initializeTransaction({
    email: `org-${orgId}@govclerkminutes.com`,
    amount: amountCents,
    currency: "ZAR",
    callbackUrl: `${baseUrl}/a/dashboard`,
    metadata: {
      mode: "stream_topup",
      org_id: orgId,
      hours,
    },
  });

  return res.status(200).json({ url: result.authorizationUrl });
}

export default withErrorReporting(handler);
