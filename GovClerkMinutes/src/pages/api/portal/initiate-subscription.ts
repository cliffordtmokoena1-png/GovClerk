/**
 * POST /api/portal/initiate-subscription
 *
 * Called when a client confirms their plan + billing day choice.
 * Calculates the pro-rata amount, initializes a Paystack one-time charge,
 * upserts the subscription row, and returns the Paystack authorization URL.
 *
 * Body:
 * {
 *   orgId: string;
 *   tier: "starter" | "professional" | "enterprise";
 *   billingDay: 1 | 15 | 25 | 26 | 28;
 *   adminEmail: string;
 *   callbackUrl: string;
 * }
 */

import { NextRequest } from "next/server";
import { getPortalDbConnection } from "@/utils/portalDb";
import { jsonResponse, errorResponse } from "@/utils/apiHelpers";
import {
  PORTAL_PAYSTACK_PLANS,
  getPortalPlanCode,
  initializePaystackTransaction,
} from "@/utils/portalPaystack";
import {
  ALLOWED_BILLING_DAYS,
  calculateProRata,
  calculateProRataTokens,
} from "@/utils/portalBillingUtils";
import type { PortalTier } from "@/utils/portalPaystack";
import type { BillingDay } from "@/utils/portalBillingUtils";

export const config = {
  runtime: "edge",
};

const VALID_TIERS: PortalTier[] = ["starter", "professional", "enterprise"];

export default async function handler(req: NextRequest): Promise<Response> {
  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  let body: {
    orgId?: unknown;
    tier?: unknown;
    billingDay?: unknown;
    adminEmail?: unknown;
    callbackUrl?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid request body", 400);
  }

  const { orgId, tier, billingDay, adminEmail, callbackUrl } = body;

  if (!orgId || typeof orgId !== "string") {
    return errorResponse("orgId is required", 400);
  }
  if (!tier || typeof tier !== "string" || !VALID_TIERS.includes(tier as PortalTier)) {
    return errorResponse("tier must be one of: starter, professional, enterprise", 400);
  }
  if (
    !billingDay ||
    typeof billingDay !== "number" ||
    !(ALLOWED_BILLING_DAYS as readonly number[]).includes(billingDay)
  ) {
    return errorResponse("billingDay must be one of: 1, 15, 25, 26, 28", 400);
  }
  if (!adminEmail || typeof adminEmail !== "string") {
    return errorResponse("adminEmail is required", 400);
  }
  if (!callbackUrl || typeof callbackUrl !== "string") {
    return errorResponse("callbackUrl is required", 400);
  }

  const validatedTier = tier as PortalTier;
  const validatedBillingDay = billingDay as BillingDay;

  const plan = PORTAL_PAYSTACK_PLANS[validatedTier];
  const monthlyPriceZar = plan.monthly_zar;

  const signupDate = new Date();
  const { proRataAmountZar, firstBillingDate } = calculateProRata(
    signupDate,
    validatedBillingDay,
    monthlyPriceZar
  );

  const prorataTokens =
    validatedTier === "professional"
      ? calculateProRataTokens(signupDate, validatedBillingDay, plan.minutes_tokens)
      : null;

  const reference = `portal_prorata_${orgId}_${Date.now()}`;

  let authorizationUrl: string;
  let paystackReference: string;
  try {
    const result = await initializePaystackTransaction({
      email: adminEmail,
      amountZar: proRataAmountZar,
      reference,
      metadata: {
        type: "portal_prorata",
        orgId,
        tier: validatedTier,
        billingDay: validatedBillingDay,
      },
      callbackUrl,
    });
    authorizationUrl = result.authorizationUrl;
    paystackReference = result.reference;
  } catch (err) {
    console.error("[initiate-subscription] Paystack error:", err);
    return errorResponse("Failed to initialize payment. Please try again.", 502);
  }

  const conn = getPortalDbConnection();
  const planCode = getPortalPlanCode(validatedTier);

  await conn.execute(
    `INSERT INTO gc_portal_subscriptions (
      org_id, tier, monthly_price_zar, status,
      preferred_billing_day, prorata_amount_zar, prorata_tokens,
      paystack_plan_code, seats_included, stream_hours_included
    ) VALUES (?, ?, ?, 'pending_activation', ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      tier                  = VALUES(tier),
      monthly_price_zar     = VALUES(monthly_price_zar),
      status                = 'pending_activation',
      preferred_billing_day = VALUES(preferred_billing_day),
      prorata_amount_zar    = VALUES(prorata_amount_zar),
      prorata_tokens        = VALUES(prorata_tokens),
      paystack_plan_code    = VALUES(paystack_plan_code),
      seats_included        = VALUES(seats_included),
      stream_hours_included = VALUES(stream_hours_included)`,
    [
      orgId,
      validatedTier,
      monthlyPriceZar,
      validatedBillingDay,
      proRataAmountZar,
      prorataTokens,
      planCode,
      plan.seats,
      plan.stream_hours,
    ]
  );

  console.log(
    `[initiate-subscription] org=${orgId} tier=${validatedTier} billingDay=${validatedBillingDay} proRata=${proRataAmountZar} ref=${paystackReference}`
  );

  return jsonResponse({
    authorizationUrl,
    proRataAmountZar,
    firstBillingDate: firstBillingDate.toISOString(),
  });
}
