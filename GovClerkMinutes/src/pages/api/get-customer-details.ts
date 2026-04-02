import { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import { connect } from "@planetscale/database";
import withErrorReporting from "@/error/withErrorReporting";
import { getCurrentBalance } from "./get-tokens";
import { SubscriptionPlan, isPlanAnnual } from "@/utils/price";
import { resolveRequestContext } from "@/utils/resolveRequestContext";
import { getPlanFromPlanCode, getTokensForPlan } from "@/utils/paystack";
import { isUnknownColumnOrMissingTableError } from "@/utils/dbErrors";

/** @deprecated kept for backward-compat; use isUnknownColumnOrMissingTableError from @/utils/dbErrors */
function isActionColumnMissing(error: unknown): boolean {
  return isUnknownColumnOrMissingTableError(error);
}

async function autoGrantTrialTokens(
  conn: ReturnType<typeof connect>,
  userId: string
): Promise<number> {
  try {
    // Idempotency check: skip if a grant row already exists.
    // If 'action' column is missing (errno 1054) treat as no existing row.
    let existingRows: unknown[] = [];
    try {
      existingRows = await conn
        .execute("SELECT id FROM payments WHERE user_id = ? AND action = 'add' LIMIT 1", [userId])
        .then((res) => res.rows);
    } catch (selectErr: unknown) {
      if (!isActionColumnMissing(selectErr)) {
        throw selectErr;
      }
      // 'action' column missing — fallback: check without action filter
      existingRows = await conn
        .execute("SELECT id FROM payments WHERE user_id = ? AND credit = 30 LIMIT 1", [userId])
        .then((res) => res.rows);
    }

    if (existingRows.length > 0) {
      return (await getCurrentBalance(userId, null)) ?? 0;
    }

    try {
      await conn.execute('INSERT INTO payments (user_id, credit, action) VALUES (?, 30, "add")', [
        userId,
      ]);
    } catch (insertErr: unknown) {
      if (isActionColumnMissing(insertErr)) {
        console.warn("[get-customer-details] 'action' column not found, retrying without it");
        await conn.execute("INSERT INTO payments (user_id, credit) VALUES (?, 30)", [userId]);
      } else {
        throw insertErr;
      }
    }
    console.info(`[get-customer-details] Auto-granted 30 trial tokens to user ${userId}`);
    return 30;
  } catch (err) {
    console.error(`[get-customer-details] Failed to auto-grant tokens for user ${userId}:`, err);
    return 0;
  }
}

export type PauseReason =
  | { kind: "BadCadence" }
  | { kind: "TooExpensive" }
  | { kind: "BetterAlternative" }
  | { kind: "NotNeeded" }
  | { kind: "BadQuality" }
  | { kind: "Other"; feedback?: string };

export type SubscriptionStatus =
  | "free"
  | "active"
  | "canceled"
  | "cancel_at_period_end"
  | "delinquent";

export type BillingModel = "self_service" | "contract";

/** Billing interval for subscription plans. */
export type BillingInterval = "day" | "week" | "month" | "year" | null;

export type ApiGetCustomerDetailsResponse = {
  subscriptionStatus: SubscriptionStatus;
  planName: SubscriptionPlan;
  tokensPerMonth: number;
  interval: BillingInterval;
  nextBillDate: string;
  remainingToken: number;
  isFreeUser: boolean;
  country: string | null;
  billingModel: BillingModel;
};

export async function getCustomerDetails(
  userId: string,
  orgId: string | null = null
): Promise<ApiGetCustomerDetailsResponse> {
  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  let query: string;
  let params: string[];

  if (orgId) {
    query =
      "SELECT paystack_customer_code, paystack_subscription_code, paystack_plan_code, billing_model FROM gc_customers WHERE org_id = ?";
    params = [orgId];
  } else {
    query =
      "SELECT paystack_customer_code, paystack_subscription_code, paystack_plan_code, billing_model FROM gc_customers WHERE user_id = ?";
    params = [userId];
  }

  const customerRows = await conn
    .execute(query, params)
    .then((result) => result.rows)
    .catch((err: unknown) => {
      if (isUnknownColumnOrMissingTableError(err)) {
        console.warn(
          "[get-customer-details] PayStack columns not found in gc_customers " +
            "(schema migration pending). Falling back to free-user defaults."
        );
        return [] as { [key: string]: unknown }[];
      }
      throw err;
    });

  let planName: SubscriptionPlan = "Free";
  let subscriptionStatus: ApiGetCustomerDetailsResponse["subscriptionStatus"] = "free";
  let tokensPerMonth = 30;
  let interval: BillingInterval = null;
  let nextBillDate = "";
  let remainingToken = 0;
  let isFreeUser = true;
  let country = null;
  let billingModel: BillingModel = "self_service";

  if (customerRows.length > 0) {
    const customerRow = customerRows[customerRows.length - 1];
    billingModel = customerRow["billing_model"];
    const paystackSubscriptionCode: string | null =
      customerRow["paystack_subscription_code"] ?? null;
    const paystackPlanCode: string | null = customerRow["paystack_plan_code"] ?? null;

    // Derive subscription status and plan details from the stored PayStack codes.
    // The subscription code is written to gc_customers by the PayStack webhook
    // (/api/webhook/paystack) when a charge.success or subscription.create event fires.
    if (paystackSubscriptionCode) {
      isFreeUser = false;
      subscriptionStatus = "active";
      // Derive plan name and token allocation from the stored PayStack plan code.
      if (paystackPlanCode != null) {
        const resolvedPlan = getPlanFromPlanCode(paystackPlanCode) ?? "Basic";
        planName = resolvedPlan;
        tokensPerMonth = getTokensForPlan(resolvedPlan);
        interval = isPlanAnnual(resolvedPlan) ? "year" : "month";
      } else {
        planName = "Basic";
        tokensPerMonth = 300;
        interval = "month";
      }
    }
  }

  const balance = await getCurrentBalance(userId, orgId);
  if (balance === null && !orgId) {
    // New user with no payment rows — auto-grant 30 trial tokens so the
    // dashboard always shows the correct initial balance.
    console.warn(
      `[get-customer-details] No payment rows for user ${userId}, auto-granting 30 trial tokens`
    );
    remainingToken = await autoGrantTrialTokens(conn, userId);
  } else {
    remainingToken = balance ?? 0;
  }

  return {
    subscriptionStatus,
    planName,
    tokensPerMonth,
    interval,
    nextBillDate,
    remainingToken,
    isFreeUser,
    country,
    billingModel,
  };
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = getAuth(req, { treatPendingAsSignedOut: false });
  if (auth.userId == null) {
    res.status(401).end();
    return;
  }

  const orgId = req.body?.orgId;
  const { userId, orgId: resolvedOrgId } = await resolveRequestContext(
    auth.userId,
    orgId,
    req.headers
  );

  const customerDetails = await getCustomerDetails(userId, resolvedOrgId);

  return res.status(200).json(customerDetails);
}

export default withErrorReporting(handler);
