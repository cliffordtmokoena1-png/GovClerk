/**
 * POST /api/portal/webhook/paystack-portal
 *
 * Handles Paystack webhook events for GovClerk Portal subscriptions.
 *
 * Signature verification uses HMAC-SHA512 of the raw request body with
 * PAYSTACK_SECRET_KEY before processing any event.
 *
 * Supported events:
 *   - charge.success        → pro-rata payment or recurring monthly charge
 *   - subscription.create   → recurring subscription created
 *   - subscription.disable  → subscription cancelled
 *   - charge.failed         → charge failed — suspend plan, no tokens
 *
 * Runtime: nodejs (needs crypto and raw body access)
 */

import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { connect } from "@planetscale/database";
import { getPortalDbConnection } from "@/utils/portalDb";
import { isUnknownColumnOrMissingTableError } from "@/utils/dbErrors";
import {
  sendPortalWelcomeEmail,
  sendPortalPaymentFailedEmail,
} from "@/utils/portalEmails";

export const config = {
  api: {
    bodyParser: false,
  },
};

// ---------------------------------------------------------------------------
// Raw body reader
// ---------------------------------------------------------------------------

function readRawBody(req: NextApiRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

// ---------------------------------------------------------------------------
// Payload shapes
// ---------------------------------------------------------------------------

interface PaystackCustomer {
  id: number;
  email: string;
  customer_code: string;
  first_name?: string | null;
  last_name?: string | null;
}

interface PaystackAuthorization {
  authorization_code: string;
  bin?: string;
  last4?: string;
  brand?: string;
}

interface ChargeSuccessData {
  id: number;
  reference: string;
  amount: number;
  currency: string;
  status: string;
  paid_at: string;
  customer: PaystackCustomer;
  authorization?: PaystackAuthorization;
  metadata?: Record<string, unknown> | null;
}

interface SubscriptionEventData {
  id: number;
  subscription_code: string;
  status: string;
  plan: { plan_code: string };
  customer: PaystackCustomer;
}

interface ChargeFailedData {
  id: number;
  reference: string;
  customer: PaystackCustomer;
  metadata?: Record<string, unknown> | null;
}

interface PaystackWebhookEvent {
  event: string;
  data: ChargeSuccessData | SubscriptionEventData | ChargeFailedData;
}

// ---------------------------------------------------------------------------
// Token crediting (GovClerkMinutes users DB)
// ---------------------------------------------------------------------------

async function creditTokensToUser(email: string, tokens: number): Promise<void> {
  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  // Look up Clerk user_id via the gc_emails mapping table
  const userRows = await conn
    .execute("SELECT user_id FROM gc_emails WHERE email = ? LIMIT 1", [email.toLowerCase()])
    .then((r) => r.rows as { user_id: string }[])
    .catch(() => [] as { user_id: string }[]);

  if (userRows.length === 0) {
    console.warn(
      `[paystack-portal] No GovClerkMinutes user found for email=${email}. Tokens not credited. ` +
        `User needs to sign up at govclerkminutes.com first.`
    );
    return;
  }

  const userId = userRows[0].user_id;

  try {
    await conn.execute(
      'INSERT INTO payments (user_id, org_id, credit, action) VALUES (?, NULL, ?, "add")',
      [userId, tokens]
    );
  } catch (err: unknown) {
    // Fallback for DB branches without the 'action' column (errno 1054)
    if (isUnknownColumnOrMissingTableError(err)) {
      await conn.execute(
        "INSERT INTO payments (user_id, org_id, credit) VALUES (?, NULL, ?)",
        [userId, tokens]
      );
    } else {
      throw err;
    }
  }

  console.log(`[paystack-portal] Credited ${tokens} tokens to user_id=${userId} (${email}) via payments table`);
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

async function handleChargeSuccess(data: ChargeSuccessData): Promise<void> {
  const metadata = data.metadata ?? {};
  const orgId = typeof metadata.orgId === "string" ? metadata.orgId : null;
  const chargeType = typeof metadata.type === "string" ? metadata.type : null;
  const email = data.customer.email;

  const portalConn = getPortalDbConnection();

  if (chargeType === "portal_prorata" && orgId) {
    // Pro-rata first payment
    const authCode = data.authorization?.authorization_code ?? null;

    await portalConn.execute(
      `UPDATE gc_portal_subscriptions
       SET prorata_paid_at             = NOW(),
           status                      = 'pending_activation',
           paystack_authorization_code = ?
       WHERE org_id = ?`,
      [authCode, orgId]
    );

    // Fetch subscription details to check tier and prorata_tokens
    const subResult = await portalConn.execute(
      `SELECT tier, prorata_tokens FROM gc_portal_subscriptions WHERE org_id = ? LIMIT 1`,
      [orgId]
    );

    if (subResult.rows.length > 0) {
      const row = subResult.rows[0] as { tier: string; prorata_tokens: number | null };

      if (row.tier === "professional" && row.prorata_tokens && row.prorata_tokens > 0) {
        await creditTokensToUser(email, row.prorata_tokens);
      }
    }

    // Send welcome email
    try {
      await sendPortalWelcomeEmail(email);
    } catch (emailErr) {
      console.error("[paystack-portal] Failed to send portal welcome email:", emailErr);
    }

    console.log(`[paystack-portal] Pro-rata payment recorded for org=${orgId} email=${email}`);
    return;
  }

  if (chargeType === "portal_recurring" && orgId) {
    // Recurring monthly charge success
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    await portalConn.execute(
      `UPDATE gc_portal_subscriptions
       SET status                = 'active',
           current_period_start  = ?,
           current_period_end    = ?,
           stream_hours_used     = 0
       WHERE org_id = ?`,
      [now.toISOString().slice(0, 19).replace("T", " "), periodEnd.toISOString().slice(0, 19).replace("T", " "), orgId]
    );

    // Check tier and credit full monthly tokens if professional
    const subResult = await portalConn.execute(
      `SELECT tier FROM gc_portal_subscriptions WHERE org_id = ? LIMIT 1`,
      [orgId]
    );

    if (subResult.rows.length > 0) {
      const row = subResult.rows[0] as { tier: string };
      if (row.tier === "professional") {
        await creditTokensToUser(email, 2000);
      }
    }

    console.log(`[paystack-portal] Recurring charge success for org=${orgId} email=${email}`);
  }
}

async function handleSubscriptionCreate(data: SubscriptionEventData): Promise<void> {
  const email = data.customer.email;

  const portalConn = getPortalDbConnection();

  // Match subscription by customer email since we don't store customer_code separately
  await portalConn.execute(
    `UPDATE gc_portal_subscriptions
     SET paystack_subscription_code = ?,
         activation_scheduled_at    = NOW(),
         status                     = 'active'
     WHERE org_id IN (
       SELECT org_id FROM gc_portal_users WHERE email = ? LIMIT 1
     )`,
    [data.subscription_code, email]
  );

  console.log(
    `[paystack-portal] Subscription created: code=${data.subscription_code} email=${email}`
  );
}

async function handleSuspend(email: string, orgId: string | null): Promise<void> {
  const portalConn = getPortalDbConnection();

  if (orgId) {
    await portalConn.execute(
      `UPDATE gc_portal_subscriptions SET status = 'suspended' WHERE org_id = ?`,
      [orgId]
    );
  } else {
    // Fall back to matching by admin email
    await portalConn.execute(
      `UPDATE gc_portal_subscriptions
       SET status = 'suspended'
       WHERE org_id IN (
         SELECT org_id FROM gc_portal_users WHERE email = ? AND role = 'admin' LIMIT 1
       )`,
      [email]
    );
  }

  try {
    await sendPortalPaymentFailedEmail(email);
  } catch (emailErr) {
    console.error("[paystack-portal] Failed to send payment failed email:", emailErr);
  }

  console.log(`[paystack-portal] Subscription suspended for email=${email} org=${orgId}`);
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const rawBody = await readRawBody(req);
  const signature = req.headers["x-paystack-signature"] as string | undefined;
  const secret = process.env.PAYSTACK_SECRET_KEY ?? "";

  if (!signature) {
    console.warn("[paystack-portal] Missing x-paystack-signature header");
    res.status(200).json({ received: true });
    return;
  }

  const expected = crypto
    .createHmac("sha512", secret)
    .update(rawBody)
    .digest("hex");

  if (expected !== signature) {
    console.warn("[paystack-portal] Invalid webhook signature");
    res.status(200).json({ received: true });
    return;
  }

  let event: PaystackWebhookEvent;
  try {
    event = JSON.parse(rawBody.toString("utf8")) as PaystackWebhookEvent;
  } catch {
    console.error("[paystack-portal] Failed to parse webhook body");
    res.status(200).json({ received: true });
    return;
  }

  console.log(`[paystack-portal] Event: ${event.event}`);

  try {
    switch (event.event) {
      case "charge.success": {
        await handleChargeSuccess(event.data as ChargeSuccessData);
        break;
      }
      case "subscription.create": {
        await handleSubscriptionCreate(event.data as SubscriptionEventData);
        break;
      }
      case "subscription.disable": {
        const subData = event.data as SubscriptionEventData;
        await handleSuspend(subData.customer.email, null);
        break;
      }
      case "charge.failed": {
        const failData = event.data as ChargeFailedData;
        const meta = failData.metadata ?? {};
        const orgId = typeof meta.orgId === "string" ? meta.orgId : null;
        await handleSuspend(failData.customer.email, orgId);
        break;
      }
      default:
        console.log(`[paystack-portal] Unhandled event: ${event.event}`);
    }
  } catch (err) {
    console.error(`[paystack-portal] Error handling event ${event.event}:`, err);
  }

  res.status(200).json({ received: true });
}

export default handler;
