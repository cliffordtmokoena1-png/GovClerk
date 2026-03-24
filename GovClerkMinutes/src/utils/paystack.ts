/**
 * PayStack utility helpers.
 *
 * Stripe has been removed from this project. All payment processing
 * is now handled via the PayStack API.
 *
 * @see https://paystack.com/docs/api/
 */

import crypto from "crypto";
import type { PaidSubscriptionPlan } from "./price";

export type PaystackKeys = {
  secretKey: string;
};

export const PAYSTACK_KEYS: PaystackKeys = {
  secretKey: process.env.PAYSTACK_SECRET_KEY!,
};

/**
 * Returns the PayStack secret key for the current environment.
 * Set PAYSTACK_SECRET_KEY in your environment variables.
 */
export function getPaystackSecretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) {
    throw new Error("[paystack] PAYSTACK_SECRET_KEY is not set");
  }
  return key;
}

/**
 * Returns the PayStack public key for use in the frontend.
 * Set NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY in your environment variables.
 */
export function getPaystackPublicKey(): string {
  const key = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;
  if (!key) {
    throw new Error("[paystack] NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY is not set");
  }
  return key;
}

/**
 * Environment variable names for PayStack plan codes, keyed by plan name.
 * Set each variable in your environment to the corresponding PayStack plan code.
 *
 * Example: PAYSTACK_PLAN_ESSENTIAL_MONTHLY=PLN_xxxxxxxxxxxx
 */
const PAYSTACK_PLAN_ENV_VARS: Record<string, string> = {
  // New PayStack tiers
  Essential: "PAYSTACK_PLAN_ESSENTIAL_MONTHLY",
  Professional: "PAYSTACK_PLAN_PROFESSIONAL_MONTHLY",
  Elite: "PAYSTACK_PLAN_ELITE_MONTHLY",
  Premium: "PAYSTACK_PLAN_PREMIUM_MONTHLY",
  Essential_Annual: "PAYSTACK_PLAN_ESSENTIAL_ANNUAL",
  Professional_Annual: "PAYSTACK_PLAN_PROFESSIONAL_ANNUAL",
  Elite_Annual: "PAYSTACK_PLAN_ELITE_ANNUAL",
  Premium_Annual: "PAYSTACK_PLAN_PREMIUM_ANNUAL",
  // Legacy plan codes (kept for backward compatibility)
  Basic: "PAYSTACK_PLAN_ZA_BASIC",
  Pro: "PAYSTACK_PLAN_ZA_PRO",
  Basic_Annual: "PAYSTACK_PLAN_ZA_BASIC_ANNUAL",
  Pro_Annual: "PAYSTACK_PLAN_ZA_PRO_ANNUAL",
};

/**
 * Returns the PayStack plan code for the given plan.
 * Plan codes are read from environment variables (see PAYSTACK_PLAN_ENV_VARS).
 */
export function getPaystackPlanCode(
  plan: string,
  _country?: string | null | undefined
): string {
  const envVarName = PAYSTACK_PLAN_ENV_VARS[plan];
  if (!envVarName) {
    throw new Error(
      `[paystack] Unknown plan: ${plan}. No env var mapping found.`
    );
  }
  const code = process.env[envVarName];
  if (!code) {
    throw new Error(
      `[paystack] Plan code not configured for ${plan}. Set env var: ${envVarName}`
    );
  }
  return code;
}

/**
 * Returns the number of tokens (minutes) included per billing period for the given plan.
 */
export function getTokensForPlan(plan: PaidSubscriptionPlan): number {
  switch (plan) {
    case "Essential":
    case "Essential_Annual":
      return 300;
    case "Professional":
    case "Professional_Annual":
      return 600;
    case "Elite":
    case "Elite_Annual":
      return 900;
    case "Premium":
    case "Premium_Annual":
      return 1500;
    case "Basic":
    case "Basic_Annual":
      return 300;
    case "Pro":
    case "Pro_Annual":
      return 1200;
    default:
      return 300;
  }
}

/**
 * Looks up the plan name from a stored PayStack plan code by scanning all
 * configured plan code environment variables.
 *
 * Returns `null` if the plan code is not found in the configured env vars.
 * Falls back to heuristic detection when plan codes aren't fully configured.
 */
export function getPlanFromPlanCode(
  planCode: string
): PaidSubscriptionPlan | null {
  const allPlans = Object.keys(PAYSTACK_PLAN_ENV_VARS) as PaidSubscriptionPlan[];

  for (const plan of allPlans) {
    const envVarName = PAYSTACK_PLAN_ENV_VARS[plan];
    if (!envVarName) continue;
    const configuredCode = process.env[envVarName];
    if (configuredCode && configuredCode === planCode) {
      return plan;
    }
  }

  // Heuristic fallback: detect plan tier and interval from plan code naming
  const lower = planCode.toLowerCase();
  const isAnnual = lower.includes("annual") || lower.includes("yearly") || lower.includes("year");
  if (lower.includes("premium")) return isAnnual ? "Premium_Annual" : "Premium";
  if (lower.includes("elite")) return isAnnual ? "Elite_Annual" : "Elite";
  if (lower.includes("professional") || lower.includes("prof")) return isAnnual ? "Professional_Annual" : "Professional";
  if (lower.includes("essential")) return isAnnual ? "Essential_Annual" : "Essential";
  const isPro = lower.includes("pro");
  if (isPro) return isAnnual ? "Pro_Annual" : "Pro";
  return isAnnual ? "Basic_Annual" : "Basic";
}

/**
 * Maps a country code to its ISO 4217 currency code.
 * Used when initializing PayStack transactions for PAYG payments.
 */
export function getCurrencyForCountry(country: string | null | undefined): string {
  switch (country) {
    case "ZA":
      return "ZAR";
    case "IN":
      return "INR";
    case "PH":
      return "PHP";
    default:
      return "USD";
  }
}

// ---------------------------------------------------------------------------
// Transaction initialization
// ---------------------------------------------------------------------------

export type InitializeTransactionParams = {
  email: string;
  /** For subscription checkout: the PayStack plan code. */
  planCode?: string;
  /** For one-time payments: amount in the smallest currency unit (e.g. cents). */
  amount?: number;
  currency?: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
};

export type InitializeTransactionResult = {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
};

/**
 * Initializes a PayStack transaction (either subscription or one-time payment).
 * Returns the authorization URL to redirect the user to.
 *
 * @see https://paystack.com/docs/api/transaction/#initialize
 */
export async function initializeTransaction(
  params: InitializeTransactionParams
): Promise<InitializeTransactionResult> {
  const secretKey = getPaystackSecretKey();

  const body: Record<string, unknown> = {
    email: params.email,
    callback_url: params.callbackUrl,
  };

  if (params.planCode) {
    body.plan = params.planCode;
  }
  if (params.amount != null) {
    body.amount = params.amount;
  }

  if (params.currency) body.currency = params.currency;
  if (params.metadata) body.metadata = params.metadata;

  console.log(`[paystack] Initializing transaction. Key prefix: ${secretKey.substring(0, 8)}..., Plan Code: ${params.planCode || 'none'}`);
  const res = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`[paystack] Transaction init failed ${res.status}: ${errText}`);
  }

  const data = (await res.json()) as {
    status: boolean;
    message: string;
    data?: {
      authorization_url: string;
      access_code: string;
      reference: string;
    };
  };

  if (!data.status || !data.data) {
    throw new Error(`[paystack] Unexpected response: ${data.message}`);
  }

  return {
    authorizationUrl: data.data.authorization_url,
    accessCode: data.data.access_code,
    reference: data.data.reference,
  };
}

// ---------------------------------------------------------------------------
// Webhook verification
// ---------------------------------------------------------------------------

/**
 * Verifies a PayStack webhook request by comparing the HMAC-SHA512 signature
 * of the raw request body against the value in `x-paystack-signature`.
 *
 * @see https://paystack.com/docs/payments/webhooks/#verify-event
 */
export function verifyWebhookSignature(
  rawBody: string | Buffer,
  signature: string
): boolean {
  const secretKey = getPaystackSecretKey();
  const hash = crypto
    .createHmac("sha512", secretKey)
    .update(rawBody)
    .digest("hex");
  return hash === signature;
}

// ---------------------------------------------------------------------------
// Subscription management
// ---------------------------------------------------------------------------

export type PaystackSubscriptionInfo = {
  status: string;
  plan_code: string;
  customer_code: string;
};

/**
 * Fetches a PayStack subscription by its subscription code.
 *
 * @see https://paystack.com/docs/api/subscription/#fetch
 */
export async function getSubscription(
  subscriptionCode: string
): Promise<PaystackSubscriptionInfo | null> {
  const secretKey = getPaystackSecretKey();
  const res = await fetch(`https://api.paystack.co/subscription/${subscriptionCode}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });

  if (!res.ok) return null;

  const data = (await res.json()) as {
    status: boolean;
    data?: {
      status: string;
      plan: { plan_code: string };
      customer: { customer_code: string };
    };
  };

  if (!data.status || !data.data) return null;

  return {
    status: data.data.status,
    plan_code: data.data.plan.plan_code,
    customer_code: data.data.customer.customer_code,
  };
}

/**
 * Disables (cancels) a PayStack subscription.
 * Requires the subscription code and the email token sent to the subscriber.
 *
 * @see https://paystack.com/docs/api/subscription/#disable
 */
export async function disableSubscription(
  subscriptionCode: string,
  emailToken: string
): Promise<boolean> {
  const secretKey = getPaystackSecretKey();
  const res = await fetch("https://api.paystack.co/subscription/disable", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ code: subscriptionCode, token: emailToken }),
  });

  if (!res.ok) return false;
  const data = (await res.json()) as { status: boolean };
  return data.status;
}

/**
 * Lists all active subscriptions for a PayStack customer.
 *
 * @see https://paystack.com/docs/api/subscription/#list
 */
export async function listCustomerSubscriptions(
  customerCode: string
): Promise<Array<{ subscription_code: string; status: string; email_token: string }>> {
  const secretKey = getPaystackSecretKey();
  const res = await fetch(
    `https://api.paystack.co/subscription?customer=${encodeURIComponent(customerCode)}`,
    { headers: { Authorization: `Bearer ${secretKey}` } }
  );

  if (!res.ok) return [];

  const data = (await res.json()) as {
    status: boolean;
    data?: Array<{ subscription_code: string; status: string; email_token: string }>;
  };

  if (!data.status || !data.data) return [];
  return data.data;
}
