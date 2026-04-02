import { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import withErrorReporting from "@/error/withErrorReporting";
import getPrimaryEmail from "@/utils/email";
import { getSiteFromRequest } from "@/utils/site";
import {
  getPlanFromPriceId,
  getCountryFromPriceId,
  getPayAsYouGoInfoFromPriceId,
  getPayAsYouGoPackPrice,
  getPrice,
  type PaidSubscriptionPlan,
} from "@/utils/price";
import {
  initializeTransaction,
  getPaystackPlanCode,
  getCurrencyForCountry,
} from "@/utils/paystack";

/**
 * Parameters for creating a PayStack checkout session.
 *
 * `priceId` is accepted for backward compatibility with existing frontend callers.
 * When `plan` and `country` are provided they take precedence over `priceId`.
 */
export type CreateCheckoutSessionParams = {
  clientReferenceId: string;
  customerEmail?: string;
  /** Explicit plan name (preferred for subscription mode). */
  plan?: PaidSubscriptionPlan;
  /** Country code (e.g. "ZA", "IN", "PH"). */
  country?: string;
  /** Legacy price ID — used to derive plan/country/amount when `plan` is absent. */
  priceId?: string;
  mode: "payment" | "subscription";
  quantity?: number;
  successUrl?: string;
  cancelUrl?: string;
  promoCode?: string;
  orgId?: string | null;
};

export type CreateCheckoutSessionResult = {
  url: string;
  reference: string;
};

/**
 * Creates a PayStack checkout session for a subscription or one-time payment.
 *
 * For subscriptions the user is redirected to the PayStack hosted payment page
 * for the matching plan. For one-time PAYG payments the amount is derived from
 * the plan/token pack and a standard transaction is initialized.
 */
export async function createCheckoutSession(
  params: CreateCheckoutSessionParams
): Promise<CreateCheckoutSessionResult> {
  const { clientReferenceId, customerEmail, mode, successUrl, orgId } = params;

  if (!customerEmail) {
    throw new Error("[create-checkout-session] customerEmail is required");
  }

  const callbackUrl =
    successUrl ?? `${process.env.NEXT_PUBLIC_APP_URL ?? "https://govclerkminutes.com"}/sign-in`;

  // Shared metadata persisted with the PayStack transaction so the webhook can
  // identify the user, plan, and any associated transcript.
  const [rawTranscriptId, rawUserId] = clientReferenceId.split("_____");
  const userId = rawUserId?.trim() || undefined;
  const transcriptId = rawTranscriptId?.trim() || undefined;

  if (mode === "subscription") {
    // -----------------------------------------------------------------------
    // Subscription checkout: initialize a PayStack transaction tied to a plan
    // -----------------------------------------------------------------------
    let plan = params.plan;
    let country = params.country;

    // Fall back to deriving plan/country from legacy Stripe priceId
    if (!plan && params.priceId) {
      const derived = getPlanFromPriceId(params.priceId);
      if (!derived) {
        throw new Error(
          `[create-checkout-session] Cannot derive plan from priceId: ${params.priceId}`
        );
      }
      plan = derived;
      country = country ?? getCountryFromPriceId(params.priceId) ?? undefined;
    }

    if (!plan) {
      throw new Error("[create-checkout-session] plan is required for subscription mode");
    }

    const planCode = getPaystackPlanCode(plan, country);
    const price = getPrice(country ?? null, plan);
    const amountInSmallestUnit = Math.round(price * 100);

    const result = await initializeTransaction({
      email: customerEmail,
      planCode,
      amount: amountInSmallestUnit,
      callbackUrl,
      metadata: {
        client_reference_id: clientReferenceId,
        user_id: userId,
        transcript_id: transcriptId,
        plan,
        country,
        org_id: orgId ?? null,
        mode: "subscription",
        source: "web_checkout",
      },
    });

    return { url: result.authorizationUrl, reference: result.reference };
  } else {
    // -----------------------------------------------------------------------
    // One-time payment checkout (pay-as-you-go)
    // Derive the amount from the legacy Stripe priceId field, which encodes
    // country, plan tier, and token pack in the PRICE_IDS lookup table.
    // -----------------------------------------------------------------------
    if (!params.priceId) {
      throw new Error("[create-checkout-session] priceId is required for payment mode");
    }

    const info = getPayAsYouGoInfoFromPriceId(params.priceId);
    if (!info) {
      throw new Error(
        `[create-checkout-session] Cannot derive PAYG info from priceId: ${params.priceId}`
      );
    }

    const price = getPayAsYouGoPackPrice(info.country, info.plan, info.tokens);
    // PayStack expects amounts in the smallest currency unit.
    // For all currencies used here (ZAR, INR, PHP, USD) the smallest unit is
    // 1/100 of the main currency (cents/paise/sentimo). Multiply by 100.
    const amountInSmallestUnit = Math.round(price * 100);
    const currency = getCurrencyForCountry(info.country);

    const result = await initializeTransaction({
      email: customerEmail,
      amount: amountInSmallestUnit,
      currency,
      callbackUrl:
        successUrl ??
        `${process.env.NEXT_PUBLIC_APP_URL ?? "https://govclerkminutes.com"}/checkout`,
      metadata: {
        client_reference_id: clientReferenceId,
        user_id: userId,
        transcript_id: transcriptId,
        tokens: info.tokens,
        org_id: orgId ?? null,
        mode: "payment",
        source: "web_checkout",
      },
    });

    return { url: result.authorizationUrl, reference: result.reference };
  }
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = getAuth(req);
  if (auth.userId == null) {
    return res.status(401).json({});
  }

  if (req.method !== "POST") {
    return res.status(405).end("Method Not Allowed");
  }

  const body = req.body as CreateCheckoutSessionParams;

  // Resolve customer email if not provided
  let customerEmail = body.customerEmail;
  if (!customerEmail) {
    const site = getSiteFromRequest(req);
    customerEmail = (await getPrimaryEmail(auth.userId, site)) ?? undefined;
  }

  if (!customerEmail) {
    return res.status(400).json({ error: "Could not resolve customer email" });
  }

  try {
    const result = await createCheckoutSession({
      ...body,
      customerEmail,
    });
    return res.status(200).json({ url: result.url, reference: result.reference });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[create-checkout-session] Failed to create checkout session for userId=${auth.userId} plan=${body.plan ?? body.priceId ?? "(unknown)"} mode=${body.mode}:`,
      err
    );
    return res.status(500).json({ error: message });
  }
}

export default withErrorReporting(handler);
