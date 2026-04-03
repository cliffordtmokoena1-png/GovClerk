/**
 * PayStack integration utilities for the GovClerk Public Portal.
 *
 * Portal subscriptions use fixed monthly pricing (ZAR) based on seat count
 * and live streaming hours. This is completely separate from GovClerkMinutes
 * token-based billing.
 */

export const PAYSTACK_BASE_URL = "https://api.paystack.co";

// PayStack plan codes for portal tiers
// Set the matching environment variables in production.
export const PORTAL_PAYSTACK_PLANS = {
  starter: {
    ZA: process.env.PAYSTACK_PORTAL_STARTER_PLAN_CODE || "PLN_portal_starter_za",
    monthly_zar: 2500,
    seats: 5,
    stream_hours: 10,
    minutes_tokens: 0,
  },
  professional: {
    ZA: process.env.PAYSTACK_PORTAL_PROFESSIONAL_PLAN_CODE || "PLN_portal_pro_za",
    monthly_zar: 8000,
    seats: 15,
    stream_hours: 20,
    minutes_tokens: 2000,
  },
  enterprise: {
    ZA: process.env.PAYSTACK_PORTAL_ENTERPRISE_PLAN_CODE || "PLN_portal_enterprise_za",
    monthly_zar: 20000,
    seats: 50,
    stream_hours: 20,
    minutes_tokens: 0,
  },
} as const;

export type PortalTier = keyof typeof PORTAL_PAYSTACK_PLANS;

/** Overage rates applied on top of the base plan. */
export const PORTAL_OVERAGE_RATES = {
  /** Cost per additional admin seat per month (ZAR). */
  seat_zar: 250,
  /** Cost per additional live-stream hour per month (ZAR). */
  stream_hour_zar: 800,
} as const;

/**
 * Returns the PayStack plan code for the given tier.
 * Falls back to the ZA plan code (single region for now).
 */
export function getPortalPlanCode(tier: PortalTier): string {
  return PORTAL_PAYSTACK_PLANS[tier].ZA;
}

/**
 * Returns the base pricing details for a given tier.
 */
export function getPortalPricing(tier: PortalTier): {
  monthly_zar: number;
  seats: number;
  stream_hours: number;
} {
  const { monthly_zar, seats, stream_hours } = PORTAL_PAYSTACK_PLANS[tier];
  return { monthly_zar, seats, stream_hours };
}

/**
 * Calculates the estimated monthly cost for a custom configuration.
 * Uses the closest base tier and adds overage charges.
 *
 * @param seats         Number of admin seats required.
 * @param stream_hours  Monthly live-stream hours required.
 * @returns             Estimated monthly cost in ZAR and the recommended base tier.
 */
export function estimatePortalCost(
  seats: number,
  stream_hours: number
): { estimated_zar: number; recommended_tier: PortalTier } {
  let recommended_tier: PortalTier = "starter";

  if (
    seats > PORTAL_PAYSTACK_PLANS.professional.seats ||
    stream_hours > PORTAL_PAYSTACK_PLANS.professional.stream_hours
  ) {
    recommended_tier = "enterprise";
  } else if (
    seats > PORTAL_PAYSTACK_PLANS.starter.seats ||
    stream_hours > PORTAL_PAYSTACK_PLANS.starter.stream_hours
  ) {
    recommended_tier = "professional";
  }

  const base = PORTAL_PAYSTACK_PLANS[recommended_tier];
  const extra_seats = Math.max(0, seats - base.seats);
  const extra_hours = Math.max(0, stream_hours - base.stream_hours);

  const estimated_zar =
    base.monthly_zar +
    extra_seats * PORTAL_OVERAGE_RATES.seat_zar +
    extra_hours * PORTAL_OVERAGE_RATES.stream_hour_zar;

  return { estimated_zar, recommended_tier };
}

/**
 * Create a one-time Paystack charge (for the pro-rata first payment).
 * Uses the /transaction/initialize endpoint.
 * Amount is in KOBO (ZAR cents × 100).
 */
export async function initializePaystackTransaction(params: {
  email: string;
  amountZar: number;
  reference: string;
  metadata?: Record<string, unknown>;
  callbackUrl?: string;
}): Promise<{ authorizationUrl: string; reference: string }> {
  const { email, amountZar, reference, metadata, callbackUrl } = params;
  const amountKobo = Math.round(amountZar * 100);

  const body: Record<string, unknown> = {
    email,
    amount: amountKobo,
    reference,
    currency: "ZAR",
  };
  if (metadata) body.metadata = metadata;
  if (callbackUrl) body.callback_url = callbackUrl;

  const res = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Paystack transaction initialize failed: ${res.status} ${errText}`);
  }

  const data = (await res.json()) as {
    status: boolean;
    data?: { authorization_url: string; reference: string };
  };

  if (!data.status || !data.data) {
    throw new Error("Paystack transaction initialize returned unexpected response");
  }

  return {
    authorizationUrl: data.data.authorization_url,
    reference: data.data.reference,
  };
}

/**
 * Create a recurring Paystack subscription for a customer who has already
 * been charged the pro-rata amount and has a valid Paystack authorization code.
 *
 * Uses POST /subscription.
 */
export async function createPaystackSubscription(params: {
  customerEmail: string;
  planCode: string;
  authorizationCode: string;
  startDate: Date;
}): Promise<{ subscriptionCode: string; subscriptionId: number }> {
  const { customerEmail, planCode, authorizationCode, startDate } = params;

  const body = {
    customer: customerEmail,
    plan: planCode,
    authorization: authorizationCode,
    start_date: startDate.toISOString(),
  };

  const res = await fetch(`${PAYSTACK_BASE_URL}/subscription`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Paystack create subscription failed: ${res.status} ${errText}`);
  }

  const data = (await res.json()) as {
    status: boolean;
    data?: { subscription_code: string; id: number };
  };

  if (!data.status || !data.data) {
    throw new Error("Paystack create subscription returned unexpected response");
  }

  return {
    subscriptionCode: data.data.subscription_code,
    subscriptionId: data.data.id,
  };
}
