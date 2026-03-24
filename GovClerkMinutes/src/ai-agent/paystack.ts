import type { PlanType } from "./types";
import { PAYSTACK_PLAN_CODES } from "./types";

export interface PaystackInitResult {
  authorizationUrl: string;
  reference: string;
}

/**
 * Initialise a PayStack subscription transaction for the given plan and
 * customer email. Returns the hosted payment URL and a transaction reference.
 *
 * @see https://paystack.com/docs/api/transaction/#initialize
 */
export async function initializePaystackPayment(
  email: string,
  plan: PlanType
): Promise<PaystackInitResult> {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    throw new Error("[paystack] PAYSTACK_SECRET_KEY is not set");
  }

  const planCode = PAYSTACK_PLAN_CODES[plan];

  const res = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      plan: planCode,
      // PayStack ignores `amount` when a plan code is provided, but the
      // field is required by the API schema. We pass 0 as a placeholder.
      amount: 0,
      currency: "ZAR",
      callback_url: "https://govclerkminutes.com/payment-success",
      metadata: {
        source: "whatsapp_ai_agent",
        plan,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`[paystack] API error ${res.status}: ${errText}`);
  }

  const data = (await res.json()) as {
    status: boolean;
    data?: { authorization_url: string; reference: string };
    message?: string;
  };

  if (!data.status || !data.data) {
    throw new Error(`[paystack] Unexpected response: ${data.message ?? "no data"}`);
  }

  return {
    authorizationUrl: data.data.authorization_url,
    reference: data.data.reference,
  };
}
