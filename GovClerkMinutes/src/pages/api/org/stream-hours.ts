import { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import { getPortalDbConnection } from "@/utils/portalDb";
import { PortalTier } from "@/utils/portalPaystack";
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

  const conn = getPortalDbConnection();

  const now = new Date();
  const billingMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

  // Read from gc_portal_subscriptions — the single source of truth for streaming hours
  const subRows = await conn
    .execute(
      "SELECT stream_hours_included, stream_hours_used, tier FROM gc_portal_subscriptions WHERE org_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1",
      [orgId]
    )
    .then((r) => r.rows as { stream_hours_included: number; stream_hours_used: number; tier: string }[])
    .catch(() => [] as { stream_hours_included: number; stream_hours_used: number; tier: string }[]);

  let minutesUsed: number;
  let minutesAllowed: number;
  let planTier: PortalTier | null;

  if (subRows.length > 0) {
    const sub = subRows[0];
    minutesUsed = Number(sub.stream_hours_used) * 60;
    minutesAllowed = Number(sub.stream_hours_included) * 60;
    planTier = (sub.tier ?? null) as PortalTier | null;
  } else {
    // No active subscription — fall back to 10-hour (600 minutes) default
    minutesUsed = 0;
    minutesAllowed = 600;
    planTier = null;
  }

  return res.status(200).json({ minutesUsed, minutesAllowed, planTier, billingMonth });
}

export default withErrorReporting(handler);
