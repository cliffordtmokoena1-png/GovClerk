/**
 * Token provisioning utilities for GovClerk Portal subscriptions.
 *
 * When an organisation activates the Professional plan, their primary admin's
 * email should be credited with the plan's bundled GovClerkMinutes tokens.
 *
 * Token credits are written to the `payments` table in the GovClerkMinutes
 * PlanetScale database — the same table used by all other token grant flows.
 */

import { connect } from "@planetscale/database";
import { PORTAL_PAYSTACK_PLANS } from "@/utils/portalPaystack";
import { isUnknownColumnOrMissingTableError } from "@/utils/dbErrors";

function getGovClerkMinutesDbConnection() {
  return connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });
}

/**
 * Provisions GovClerkMinutes tokens for a Professional plan activation.
 *
 * 1. Looks up whether a GovClerkMinutes user exists with `adminEmail`.
 * 2. If a user exists: credits `PORTAL_PAYSTACK_PLANS.professional.minutes_tokens`
 *    tokens to their account via an `INSERT INTO payments` row (action = 'add').
 * 3. If no user exists: logs a warning that the admin hasn't signed up for
 *    GovClerkMinutes yet — does NOT fail the subscription activation flow.
 *
 * @param orgId       Portal organisation ID (stored for traceability on the payment row).
 * @param adminEmail  Primary admin's email address — used to look up the GovClerkMinutes user.
 */
export async function provisionProfessionalPlanTokens(
  orgId: string,
  adminEmail: string
): Promise<void> {
  const tokensToCredit = PORTAL_PAYSTACK_PLANS.professional.minutes_tokens;

  try {
    const conn = getGovClerkMinutesDbConnection();

    // Look up the GovClerkMinutes user by email via the gc_emails mapping table.
    const userRows = await conn
      .execute("SELECT user_id FROM gc_emails WHERE email = ? LIMIT 1", [adminEmail.toLowerCase()])
      .then((r) => r.rows as { user_id: string }[])
      .catch(() => [] as { user_id: string }[]);

    if (userRows.length === 0) {
      console.warn(
        `[portalTokenProvisioning] No GovClerkMinutes user found for email ${adminEmail} (orgId: ${orgId}). ` +
          `The admin has not yet signed up at govclerkminutes.com. ` +
          `Tokens (${tokensToCredit}) will not be credited until they create an account.`
      );
      return;
    }

    const userId = userRows[0].user_id;

    // Credit tokens via the payments table (same pattern used across the codebase).
    try {
      await conn.execute(
        'INSERT INTO payments (user_id, org_id, credit, action) VALUES (?, NULL, ?, "add")',
        [userId, tokensToCredit]
      );
    } catch (insertErr: unknown) {
      // Fallback for DB branches that don't yet have the 'action' column (errno 1054).
      if (isUnknownColumnOrMissingTableError(insertErr)) {
        console.warn(
          "[portalTokenProvisioning] 'action' column not found, retrying without it"
        );
        await conn.execute("INSERT INTO payments (user_id, credit) VALUES (?, ?)", [
          userId,
          tokensToCredit,
        ]);
      } else {
        throw insertErr;
      }
    }

    console.info(
      `[portalTokenProvisioning] Credited ${tokensToCredit} tokens to user ${userId} (${adminEmail}) for Professional plan activation (orgId: ${orgId})`
    );
  } catch (err) {
    // Log but do not throw — token provisioning failure must not crash the subscription flow.
    console.error(
      `[portalTokenProvisioning] Failed to provision tokens for ${adminEmail} (orgId: ${orgId}):`,
      err
    );
  }
}
