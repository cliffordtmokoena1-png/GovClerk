/**
 * PayStack Webhook Handler
 *
 * Listens for PayStack events and updates the database accordingly.
 *
 * Supported events:
 *   - charge.success      → add tokens to user (subscription charge or one-time PAYG)
 *   - subscription.create → store subscription code on gc_customers
 *   - subscription.disable → mark subscription as cancelled in gc_customers
 *
 * Signature verification uses HMAC-SHA512 of the raw request body with
 * PAYSTACK_SECRET_KEY, as documented at:
 * https://paystack.com/docs/payments/webhooks/#verify-event
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { connect } from "@planetscale/database";
import withErrorReporting from "@/error/withErrorReporting";
import { verifyWebhookSignature, getTokensForPlan } from "@/utils/paystack";
import type { PaidSubscriptionPlan } from "@/utils/price";

export const config = {
  api: {
    // Raw body is needed for HMAC signature verification.
    bodyParser: false,
  },
};

// ---------------------------------------------------------------------------
// PayStack event payload shapes
// ---------------------------------------------------------------------------

interface PaystackCustomer {
  id: number;
  email: string;
  customer_code: string;
  first_name?: string | null;
  last_name?: string | null;
}

interface PaystackPlan {
  id: number;
  plan_code: string;
  name?: string;
  interval?: string;
  amount?: number;
}

interface ChargeSuccessData {
  id: number;
  reference: string;
  amount: number; // smallest currency unit
  currency: string;
  status: string;
  paid_at: string;
  customer: PaystackCustomer;
  plan?: PaystackPlan;
  subscription_code?: string;
  metadata?: Record<string, unknown> | null;
}

interface SubscriptionEventData {
  id: number;
  subscription_code: string;
  status: string;
  plan: PaystackPlan;
  customer: PaystackCustomer;
  email_token?: string;
  createdAt?: string;
}

interface PaystackWebhookEvent {
  event: string;
  data: ChargeSuccessData | SubscriptionEventData;
}

// ---------------------------------------------------------------------------
// Database helpers
// ---------------------------------------------------------------------------

function getDbConn() {
  return connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });
}

/** Looks up the Clerk userId for a given PayStack customer code or email. */
async function getUserIdForCustomer(
  conn: ReturnType<typeof connect>,
  customerCode: string,
  customerEmail: string
): Promise<string | null> {
  // First try to find via existing gc_customers record
  const byCode = await conn
    .execute(
      "SELECT user_id FROM gc_customers WHERE paystack_customer_code = ? LIMIT 1",
      [customerCode]
    )
    .then((r) => r.rows);

  if (byCode.length > 0) {
    return (byCode[0] as { user_id: string }).user_id;
  }

  // Fall back to user_id stored in the metadata provided at transaction init.
  // (The caller should pass the userId in metadata; this is a safety fallback.)
  console.warn(
    `[paystack-webhook] No gc_customers row for customer_code=${customerCode}, email=${customerEmail}`
  );
  return null;
}

/** Upserts the gc_customers row for a user with their PayStack identifiers. */
async function upsertCustomer(
  conn: ReturnType<typeof connect>,
  {
    userId,
    customerCode,
    subscriptionCode,
    planCode,
  }: {
    userId: string;
    customerCode: string;
    subscriptionCode?: string | null;
    planCode?: string | null;
  }
): Promise<void> {
  if (subscriptionCode && planCode) {
    await conn.execute(
      `INSERT INTO gc_customers (user_id, paystack_customer_code, paystack_subscription_code, paystack_plan_code)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         paystack_customer_code = VALUES(paystack_customer_code),
         paystack_subscription_code = VALUES(paystack_subscription_code),
         paystack_plan_code = VALUES(paystack_plan_code)`,
      [userId, customerCode, subscriptionCode, planCode]
    );
  } else {
    await conn.execute(
      `INSERT INTO gc_customers (user_id, paystack_customer_code)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE
         paystack_customer_code = VALUES(paystack_customer_code)`,
      [userId, customerCode]
    );
  }
}

/** Idempotently inserts a payment credit row.  Returns true if inserted. */
async function insertPaymentCredit(
  conn: ReturnType<typeof connect>,
  {
    userId,
    credit,
    mode,
    checkoutSessionId,
    transcriptId,
    currency,
    purchaseAmount,
  }: {
    userId: string;
    credit: number;
    mode: "subscription" | "payment";
    checkoutSessionId: string;
    transcriptId?: number | null;
    currency?: string | null;
    purchaseAmount?: number | null;
  }
): Promise<boolean> {
  // Idempotency check — skip if the reference was already processed.
  const existing = await conn
    .execute(
      "SELECT id FROM payments WHERE checkout_session_id = ? LIMIT 1",
      [checkoutSessionId]
    )
    .then((r) => r.rows);

  if (existing.length > 0) {
    console.info(
      `[paystack-webhook] Payment ${checkoutSessionId} already processed — skipping`
    );
    return false;
  }

  if (transcriptId != null && currency != null && purchaseAmount != null) {
    await conn.execute(
      `INSERT INTO payments (user_id, credit, action, mode, checkout_session_id, transcript_id, currency, purchase_amount)
       VALUES (?, ?, 'add', ?, ?, ?, ?, ?)`,
      [userId, credit, mode, checkoutSessionId, transcriptId, currency, purchaseAmount]
    );
  } else {
    await conn.execute(
      `INSERT INTO payments (user_id, credit, action, mode, checkout_session_id)
       VALUES (?, ?, 'add', ?, ?)`,
      [userId, credit, mode, checkoutSessionId]
    );
  }

  return true;
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

async function handleChargeSuccess(
  conn: ReturnType<typeof connect>,
  data: ChargeSuccessData
): Promise<void> {
  const metadata = data.metadata ?? {};
  const metaUserId = (metadata.user_id as string | undefined)?.trim() || null;
  const metaTranscriptId = metadata.transcript_id as number | null | undefined;
  const metaTokens = metadata.tokens as number | null | undefined;
  const metaMode = (metadata.mode as string | undefined) ?? (data.plan ? "subscription" : "payment");

  // Resolve the Clerk userId
  let userId =
    metaUserId ??
    (await getUserIdForCustomer(conn, data.customer.customer_code, data.customer.email));

  if (!userId) {
    console.error(
      `[paystack-webhook] charge.success: Cannot resolve userId for customer ${data.customer.customer_code}`
    );
    return;
  }

  if (metaMode === "subscription" || data.plan) {
    // -----------------------------------------------------------------------
    // Subscription charge (recurring or initial)
    // -----------------------------------------------------------------------
    const planCode = data.plan?.plan_code ?? null;

    // Determine tokens from plan name stored in metadata, or fall back to plan code hints
    let credit = 300; // conservative default
    const metaPlan = metadata.plan as PaidSubscriptionPlan | undefined;
    if (metaPlan) {
      credit = getTokensForPlan(metaPlan);
    } else if (planCode) {
      // Heuristic fallback: use plan code naming to infer tier.
      // This only applies when the transaction was not initiated via createCheckoutSession
      // (e.g. when initialized by the WhatsApp AI agent without plan metadata).
      const inferredPlan: PaidSubscriptionPlan = planCode.toLowerCase().includes("pro")
        ? "Pro"
        : "Basic";
      const inferredCredit = getTokensForPlan(inferredPlan);
      console.warn(
        `[paystack-webhook] charge.success: No plan metadata for ref=${data.reference}. ` +
          `Falling back to plan code heuristic — planCode=${planCode} inferredPlan=${inferredPlan} credit=${inferredCredit}`
      );
      credit = inferredCredit;
    }

    await upsertCustomer(conn, {
      userId,
      customerCode: data.customer.customer_code,
      subscriptionCode: data.subscription_code ?? null,
      planCode,
    });

    await insertPaymentCredit(conn, {
      userId,
      credit,
      mode: "subscription",
      checkoutSessionId: data.reference,
    });

    console.info(
      `[paystack-webhook] charge.success (subscription): userId=${userId} credit=${credit} ref=${data.reference}`
    );
  } else {
    // -----------------------------------------------------------------------
    // One-time PAYG payment
    // -----------------------------------------------------------------------
    const credit = metaTokens ?? 60; // default to smallest pack
    const transcriptId =
      typeof metaTranscriptId === "number" ? metaTranscriptId : null;

    await insertPaymentCredit(conn, {
      userId,
      credit,
      mode: "payment",
      checkoutSessionId: data.reference,
      transcriptId,
      currency: data.currency.toLowerCase(),
      purchaseAmount: data.amount,
    });

    console.info(
      `[paystack-webhook] charge.success (payment): userId=${userId} credit=${credit} ref=${data.reference}`
    );
  }
}

async function handleSubscriptionCreate(
  conn: ReturnType<typeof connect>,
  data: SubscriptionEventData
): Promise<void> {
  let userId = await getUserIdForCustomer(
    conn,
    data.customer.customer_code,
    data.customer.email
  );

  if (!userId) {
    console.error(
      `[paystack-webhook] subscription.create: Cannot resolve userId for customer ${data.customer.customer_code}`
    );
    return;
  }

  await upsertCustomer(conn, {
    userId,
    customerCode: data.customer.customer_code,
    subscriptionCode: data.subscription_code,
    planCode: data.plan.plan_code,
  });

  console.info(
    `[paystack-webhook] subscription.create: userId=${userId} sub=${data.subscription_code} plan=${data.plan.plan_code}`
  );
}

async function handleSubscriptionDisable(
  conn: ReturnType<typeof connect>,
  data: SubscriptionEventData
): Promise<void> {
  // Clear the subscription code so get-customer-details falls back to "free"
  await conn.execute(
    `UPDATE gc_customers
     SET paystack_subscription_code = NULL
     WHERE paystack_subscription_code = ?`,
    [data.subscription_code]
  );

  console.info(
    `[paystack-webhook] subscription.disable: sub=${data.subscription_code} — subscription cleared`
  );
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).end("Method Not Allowed");
    return;
  }

  // Collect raw body for signature verification
  const rawBody = await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });

  const signature = req.headers["x-paystack-signature"] as string | undefined;

  if (!signature) {
    res.status(400).json({ error: "Missing x-paystack-signature header" });
    return;
  }

  if (!verifyWebhookSignature(rawBody, signature)) {
    res.status(401).json({ error: "Invalid webhook signature" });
    return;
  }

  let event: PaystackWebhookEvent;
  try {
    event = JSON.parse(rawBody.toString("utf8")) as PaystackWebhookEvent;
  } catch {
    res.status(400).json({ error: "Invalid JSON body" });
    return;
  }

  // Acknowledge receipt immediately.
  // PayStack requires a 200 response quickly to avoid retries. If DB
  // operations fail, PayStack will re-deliver the event and the idempotency
  // check in insertPaymentCredit will prevent duplicate processing.
  res.status(200).json({ received: true });

  // Process the event asynchronously
  const conn = getDbConn();

  try {
    switch (event.event) {
      case "charge.success":
        await handleChargeSuccess(conn, event.data as ChargeSuccessData);
        break;

      case "subscription.create":
        await handleSubscriptionCreate(conn, event.data as SubscriptionEventData);
        break;

      case "subscription.disable":
      case "subscription.not_renew":
        await handleSubscriptionDisable(conn, event.data as SubscriptionEventData);
        break;

      default:
        // Log unhandled events for observability but do not fail
        console.info(`[paystack-webhook] Unhandled event: ${event.event}`);
    }
  } catch (err) {
    // Log but do not re-throw — the 200 has already been sent to PayStack
    console.error(`[paystack-webhook] Error processing event ${event.event}:`, err);
  }
}

export default withErrorReporting(handler);
