import { getAuth } from "@clerk/nextjs/server";
import type { NextApiRequest, NextApiResponse } from "next";
import withErrorReporting from "@/error/withErrorReporting";
import { getPortalDbConnection } from "@/utils/portalDb";

type StreamHoursAdminResponse = {
  orgId: string;
  hoursAdded: number;
  newStreamHoursIncluded: number;
};

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<StreamHoursAdminResponse | { error: string }>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { userId, sessionClaims } = getAuth(req);
  if (!userId || sessionClaims?.metadata?.role !== "admin") {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { orgId, hours } = req.body as { orgId?: string; hours?: number };

  if (!orgId || typeof hours !== "number" || hours <= 0) {
    return res.status(400).json({ error: "orgId and hours (> 0) are required" });
  }

  const conn = getPortalDbConnection();

  // Add hours to stream_hours_included on the active subscription
  const result = await conn.execute(
    `UPDATE gc_portal_subscriptions
     SET stream_hours_included = stream_hours_included + ?
     WHERE org_id = ? AND status = 'active'
     ORDER BY created_at DESC
     LIMIT 1`,
    [hours, orgId]
  );

  if (!result.rowsAffected || Number(result.rowsAffected) === 0) {
    return res.status(404).json({ error: `No active subscription found for org ${orgId}` });
  }

  // Read back the new value
  const rows = await conn
    .execute(
      "SELECT stream_hours_included FROM gc_portal_subscriptions WHERE org_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1",
      [orgId]
    )
    .then((r) => r.rows as { stream_hours_included: number }[]);

  const newStreamHoursIncluded = Number(rows[0]?.stream_hours_included ?? 0);

  console.log(`[admin/stream-hours] Added ${hours}h to org=${orgId}. New included: ${newStreamHoursIncluded}h`);

  return res.status(200).json({ orgId, hoursAdded: hours, newStreamHoursIncluded });
}

export default withErrorReporting(handler);
