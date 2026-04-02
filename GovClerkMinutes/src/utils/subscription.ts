import { ApiGetCustomerDetailsResponse } from "@/pages/api/get-customer-details";
import { connect } from "@planetscale/database";
import { add, differenceInDays } from "date-fns";
import { getSubscription, listCustomerSubscriptions, disableSubscription } from "@/utils/paystack";
import { isUnknownColumnOrMissingTableError } from "@/utils/dbErrors";

export function isSubscriptionActive(subscriptionStatus: string): boolean {
  return subscriptionStatus === "active";
}

export function isSubscriptionPaused(subscriptionStatus: string): boolean {
  return subscriptionStatus === "cancel_at_period_end";
}

export function isSubscriptionDelinquent(subscriptionStatus: string): boolean {
  return subscriptionStatus === "delinquent";
}

export function isSubscriptionCanceled(subscriptionStatus: string): boolean {
  return subscriptionStatus === "canceled";
}

export function calculateUsage(subscriptionData: ApiGetCustomerDetailsResponse) {
  const currentUsage = Math.max(
    0,
    subscriptionData.tokensPerMonth - subscriptionData.remainingToken
  );
  const tokenUsagePercentage = (currentUsage / subscriptionData.tokensPerMonth) * 100;
  const excessToken = Math.max(
    0,
    subscriptionData.remainingToken - subscriptionData.tokensPerMonth
  );

  return {
    currentUsage,
    tokenUsagePercentage,
    excessToken,
    hasExcessToken: excessToken > 0,
  };
}

export function calculateDaysUntilCreditReset(
  subscriptionData: ApiGetCustomerDetailsResponse
): number {
  // Token always reset monthly, regardless of billing interval
  // For annual subscribers, we need to calculate the next monthly reset, not the annual billing date

  const today = new Date();

  if (subscriptionData.interval === "year") {
    // For annual subscribers, tokens reset monthly from the subscription start date
    // Parse the next bill date to get the original subscription day
    const nextBillDate = new Date(subscriptionData.nextBillDate);
    const subscriptionDay = nextBillDate.getDate();

    // Create a date for this month's reset day
    const thisMonthReset = new Date(today.getFullYear(), today.getMonth(), subscriptionDay);

    // If we've passed this month's reset day, calculate next month's reset
    const nextReset = today >= thisMonthReset ? add(thisMonthReset, { months: 1 }) : thisMonthReset;

    return differenceInDays(nextReset, today);
  } else {
    // For monthly subscribers, use the regular billing date
    const nextBill = new Date(subscriptionData.nextBillDate);
    return differenceInDays(nextBill, today);
  }
}

export async function getCustomerCodeFromUserId(userId: string): Promise<string | null> {
  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  const customerRows = await conn
    .execute("SELECT paystack_customer_code FROM gc_customers WHERE user_id = ?", [userId])
    .then((result) => result.rows)
    .catch((err: unknown) => {
      if (isUnknownColumnOrMissingTableError(err)) {
        console.warn(
          "[subscription] paystack_customer_code column not found in gc_customers " +
            "(schema migration pending). Returning null."
        );
        return [] as { [key: string]: unknown }[];
      }
      throw err;
    });

  if (customerRows.length > 0) {
    return customerRows[customerRows.length - 1]["paystack_customer_code"] as string | null;
  }

  return null;
}

/**
 * @deprecated Use getCustomerCodeFromUserId instead.
 * Kept for backward compatibility during PayStack migration.
 */
export async function getCustomerIdFromUserId(userId: string): Promise<string | null> {
  return getCustomerCodeFromUserId(userId);
}

/**
 * Fetches the active PayStack subscription for a customer code.
 * Returns subscription info if an active subscription exists, null otherwise.
 */
export async function getActiveSubscription(
  customerCode: string
): Promise<{ subscription_code: string; status: string; plan_code: string } | null> {
  const subscriptions = await listCustomerSubscriptions(customerCode);
  const active = subscriptions.find((s) => s.status === "active");
  if (!active) return null;

  const details = await getSubscription(active.subscription_code);
  if (!details) return null;

  return {
    subscription_code: active.subscription_code,
    status: details.status,
    plan_code: details.plan_code,
  };
}

/**
 * Cancels all active PayStack subscriptions for a user.
 * Used when a user requests account deletion or a manual cancellation.
 */
export async function deleteAllSubscriptionsForUserId(userId: string): Promise<void> {
  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  const rows = await conn
    .execute(
      "SELECT paystack_customer_code, paystack_subscription_code FROM gc_customers WHERE user_id = ?",
      [userId]
    )
    .then((r) => r.rows)
    .catch((err: unknown) => {
      if (isUnknownColumnOrMissingTableError(err)) {
        console.warn(
          "[subscription] paystack columns not found in gc_customers " +
            "(schema migration pending). Skipping cancellation."
        );
        return [] as { [key: string]: unknown }[];
      }
      throw err;
    });

  for (const row of rows) {
    const customerCode = (row as { [key: string]: unknown })["paystack_customer_code"] as
      | string
      | null;
    const subscriptionCode = (row as { [key: string]: unknown })["paystack_subscription_code"] as
      | string
      | null;

    if (!customerCode || !subscriptionCode) continue;

    // We list all active subscriptions from PayStack rather than only using
    // the stored subscription_code to handle edge cases where the database
    // record is stale or the user has multiple subscriptions (e.g. from a
    // duplicate signup). The stored subscriptionCode is used as a guard to
    // avoid querying PayStack unnecessarily for users who have no subscription.
    const subscriptions = await listCustomerSubscriptions(customerCode);
    for (const sub of subscriptions) {
      if (sub.status !== "active") continue;
      if (sub.email_token) {
        const disabled = await disableSubscription(sub.subscription_code, sub.email_token);
        if (!disabled) {
          console.warn(
            `[subscription] Failed to disable subscription ${sub.subscription_code} for userId=${userId}`
          );
        }
      }
    }

    // Clear subscription from our database
    await conn.execute(
      `UPDATE gc_customers
       SET paystack_subscription_code = NULL
       WHERE user_id = ? AND paystack_subscription_code = ?`,
      [userId, subscriptionCode]
    );
  }
}
