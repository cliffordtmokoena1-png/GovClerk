/**
 * POST /api/internal/portal/activate-pending-subscriptions
 *
 * Daily cron job that finds portal subscriptions with a preferred billing day
 * matching today, and activates their Paystack recurring subscription.
 *
 * Protected by: Authorization: Bearer ${INTERNAL_CRON_SECRET}
 *
 * Runtime: nodejs
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { getPortalDbConnection } from "@/utils/portalDb";
import { createPaystackSubscription } from "@/utils/portalPaystack";

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const authHeader = req.headers.authorization ?? "";
  const cronSecret = process.env.INTERNAL_CRON_SECRET ?? "";
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const todayDay = new Date().getDate();
  const conn = getPortalDbConnection();

  const result = await conn.execute(
    `SELECT org_id, paystack_plan_code, paystack_authorization_code
     FROM gc_portal_subscriptions
     WHERE preferred_billing_day = ?
       AND status = 'pending_activation'
       AND prorata_paid_at IS NOT NULL`,
    [todayDay]
  );

  const rows = result.rows as Array<{
    org_id: string;
    paystack_plan_code: string | null;
    paystack_authorization_code: string | null;
  }>;

  let processed = 0;
  let errors = 0;

  for (const row of rows) {
    const { org_id: orgId, paystack_plan_code: planCode, paystack_authorization_code: authCode } =
      row;

    if (!planCode || !authCode) {
      console.warn(
        `[activate-pending] Skipping org=${orgId}: missing planCode or authorizationCode`
      );
      errors++;
      continue;
    }

    try {
      const startDate = new Date();
      const { subscriptionCode } = await createPaystackSubscription({
        customerEmail: orgId,
        planCode,
        authorizationCode: authCode,
        startDate,
      });

      await conn.execute(
        `UPDATE gc_portal_subscriptions
         SET status                     = 'active',
             activation_scheduled_at    = NOW(),
             paystack_subscription_code = ?
         WHERE org_id = ?`,
        [subscriptionCode, orgId]
      );

      console.log(
        `[activate-pending] Activated subscription for org=${orgId} code=${subscriptionCode}`
      );
      processed++;
    } catch (err) {
      console.error(`[activate-pending] Failed to activate org=${orgId}:`, err);
      errors++;
    }
  }

  console.log(`[activate-pending] Done. processed=${processed} errors=${errors}`);
  res.status(200).json({ processed, errors });
}
