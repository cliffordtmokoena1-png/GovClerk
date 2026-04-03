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
    `SELECT s.org_id, s.paystack_plan_code, s.paystack_authorization_code, u.email AS admin_email
     FROM gc_portal_subscriptions s
     JOIN gc_portal_users u ON u.org_id = s.org_id AND u.role = 'admin'
     WHERE s.preferred_billing_day = ?
       AND s.status = 'pending_activation'
       AND s.prorata_paid_at IS NOT NULL
     LIMIT 100`,
    [todayDay]
  );

  const rows = result.rows as Array<{
    org_id: string;
    paystack_plan_code: string | null;
    paystack_authorization_code: string | null;
    admin_email: string | null;
  }>;

  let processed = 0;
  let errors = 0;

  for (const row of rows) {
    const {
      org_id: orgId,
      paystack_plan_code: planCode,
      paystack_authorization_code: authCode,
      admin_email: adminEmail,
    } = row;

    if (!planCode || !authCode || !adminEmail) {
      console.warn(
        `[activate-pending] Skipping org=${orgId}: missing planCode, authorizationCode, or adminEmail`
      );
      errors++;
      continue;
    }

    try {
      const startDate = new Date();
      const { subscriptionCode } = await createPaystackSubscription({
        customerEmail: adminEmail,
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
        `[activate-pending] Activated subscription for org=${orgId} email=${adminEmail} code=${subscriptionCode}`
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
