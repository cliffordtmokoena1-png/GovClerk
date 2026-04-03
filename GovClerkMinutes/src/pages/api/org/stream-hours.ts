import { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import { connect } from "@planetscale/database";
import { PORTAL_PAYSTACK_PLANS, PortalTier } from "@/utils/portalPaystack";
import withErrorReporting from "@/error/withErrorReporting";

export type StreamHoursResponse = {
  minutesUsed: number;
  minutesAllowed: number;
  planTier: PortalTier | null;
  billingMonth: string;
};

async function handler(req: NextApiRequest, res: NextApiResponse<StreamHoursResponse | { error: string }>) {
  if (req.method !== "GET") {return res.status(405).json({ error: "Method not allowed" });}

  const { orgId } = getAuth(req);
  if (!orgId) {return res.status(401).json({ error: "Unauthorized" });}

  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  const now = new Date();
  const billingMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

  // Get org's portal plan tier — fallback gracefully if table does not exist
  const planRows = await conn
    .execute("SELECT portal_tier FROM gc_org_portal_subscriptions WHERE org_id = ? AND status = 'active' LIMIT 1", [orgId])
    .then((r) => r.rows as { portal_tier: string }[])
    .catch(() => [] as { portal_tier: string }[]);

  const planTier = (planRows[0]?.portal_tier ?? null) as PortalTier | null;
  const planConfig = planTier ? PORTAL_PAYSTACK_PLANS[planTier] : null;
  // Default to 600 minutes (10 hours) for Starter when no subscription is found
  const minutesAllowed = planConfig ? planConfig.stream_hours * 60 : 600;

  // Get minutes used this month
  const usageRows = await conn
    .execute(
      "SELECT minutes_used FROM gc_org_stream_usage WHERE org_id = ? AND billing_month = ?",
      [orgId, billingMonth]
    )
    .then((r) => r.rows as { minutes_used: number }[])
    .catch(() => [] as { minutes_used: number }[]);

  const minutesUsed = usageRows[0]?.minutes_used ?? 0;

  return res.status(200).json({ minutesUsed, minutesAllowed, planTier, billingMonth });
}

export default withErrorReporting(handler);
