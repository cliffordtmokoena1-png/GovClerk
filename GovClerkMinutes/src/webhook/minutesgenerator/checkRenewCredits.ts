import { connect } from "@planetscale/database";
import { getPlanFromPlanCode, getTokensForPlan } from "@/utils/paystack";
import type { PaidSubscriptionPlan } from "@/utils/price";

/**
 * Checks and renews credits for active subscribers on a monthly schedule.
 *
 * For each user with an active PayStack subscription, grants the appropriate
 * number of tokens based on their stored plan code if they haven't received
 * a top-up in the past month.
 */
export async function checkRenewToken(): Promise<void> {
  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  const now = new Date();
  const cronMarker = `cron_renewal_${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

  await conn.transaction(async (tx) => {
    // Find subscribers who are due for a monthly top-up.
    // Include paystack_plan_code so we can grant the correct token amount.
    // The JOIN filters only by action='add' (not mode='subscription') so that
    // tokens inserted by the PayStack charge.success webhook are also counted,
    // preventing double-grants when both the webhook and the cron fire in the same month.
    const due = await tx
      .execute(
        `
          SELECT mc.user_id, mc.paystack_customer_code, mc.paystack_plan_code,
                 MAX(p.created_at) AS last_payment_date
          FROM gc_customers mc
          LEFT JOIN payments p
          ON p.user_id = mc.user_id
          AND p.action = 'add'
          WHERE mc.paystack_subscription_code IS NOT NULL
          GROUP BY mc.user_id, mc.paystack_customer_code, mc.paystack_plan_code
          HAVING MAX(p.created_at) IS NULL
          OR MAX(p.created_at) <= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 MONTH)
          `
      )
      .then((r) => r.rows);

    if (due.length === 0) {
      return;
    }

    // eslint-disable-next-line no-console
    console.log(`Found ${due.length} customers due for a token top-up`);

    const valueRows: string[] = [];
    const params: unknown[] = [];

    for (const row of due) {
      const lastCreated = row.last_payment_date;
      const planCode = row.paystack_plan_code as string | null;

      // Resolve the monthly token grant from the stored PayStack plan code.
      const plan: PaidSubscriptionPlan = planCode
        ? (getPlanFromPlanCode(planCode) ?? "Basic")
        : "Basic";
      const renewalTokens = getTokensForPlan(plan);

      valueRows.push(
        `(?, ?, 'add', 'subscription', ${lastCreated ? "DATE_ADD(?, INTERVAL 1 MONTH)" : "NOW()"}, ?)`
      );
      params.push(row.user_id, renewalTokens);
      if (lastCreated) {
        params.push(lastCreated);
      }
      params.push(cronMarker);
    }

    await tx.execute(
      `
      INSERT INTO payments (user_id, credit, action, mode, created_at, checkout_session_id)
      VALUES ${valueRows.join(",")}
      `,
      [...params]
    );
  });
}
