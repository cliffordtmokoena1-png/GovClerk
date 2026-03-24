import { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import withErrorReporting from "@/error/withErrorReporting";
import { connect } from "@planetscale/database";
import { getPaystackSecretKey } from "@/utils/paystack";
import { getCustomerCodeFromUserId } from "@/utils/subscription";
import getPrimaryEmail from "@/utils/email";
import { getSiteFromRequest } from "@/utils/site";

/**
 * Resumes a previously cancelled PayStack subscription.
 *
 * Attempts to re-enable the most recent cancelled subscription for the user.
 * If no re-enableable subscription is found, returns a checkout URL so the
 * user can subscribe again.
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { userId } = getAuth(req);
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const customerCode = await getCustomerCodeFromUserId(userId);
  if (!customerCode) {
    // No customer record — redirect to a new checkout session
    const site = getSiteFromRequest(req.headers);
    const email = await getPrimaryEmail(userId, site);
    if (!email) {
      return res.status(404).json({ error: "No subscription or customer found" });
    }
    return res.status(200).json({
      url: `${req.headers.origin ?? ""}/pricing`,
    });
  }

  const secretKey = getPaystackSecretKey();

  // List all subscriptions (including cancelled ones) for this customer
  const listRes = await fetch(
    `https://api.paystack.co/subscription?customer=${encodeURIComponent(customerCode)}`,
    { headers: { Authorization: `Bearer ${secretKey}` } }
  );

  if (!listRes.ok) {
    return res.status(500).json({ error: "Failed to fetch subscriptions from PayStack" });
  }

  const listData = (await listRes.json()) as {
    status: boolean;
    data?: Array<{
      subscription_code: string;
      status: string;
      email_token: string;
      plan: { plan_code: string };
      createdAt: string;
    }>;
  };

  if (!listData.status || !listData.data || listData.data.length === 0) {
    return res.status(200).json({ url: `${req.headers.origin ?? ""}/pricing` });
  }

  // Find the most recent subscription in a re-enableable state.
  // PayStack's re-enableable statuses are: 'non-renewing' (disabled) and 'attention' (payment issues).
  // We exclude terminal states like 'cancelled', 'completed', and 'expired'.
  const reEnableable = listData.data
    .filter((s) => s.status === "non-renewing" || s.status === "attention")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (reEnableable.length === 0 || !reEnableable[0].email_token) {
    // No re-enableable subscription — send user to pricing page to resubscribe
    return res.status(200).json({ url: `${req.headers.origin ?? ""}/pricing` });
  }

  const toEnable = reEnableable[0];

  // Re-enable the subscription via PayStack
  const enableRes = await fetch("https://api.paystack.co/subscription/enable", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      code: toEnable.subscription_code,
      token: toEnable.email_token,
    }),
  });

  if (!enableRes.ok) {
    // Could not re-enable — send user to pricing page to resubscribe
    return res.status(200).json({ url: `${req.headers.origin ?? ""}/pricing` });
  }

  const enableData = (await enableRes.json()) as { status: boolean };
  if (!enableData.status) {
    return res.status(200).json({ url: `${req.headers.origin ?? ""}/pricing` });
  }

  // Update gc_customers with the re-enabled subscription code
  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });
  await conn.execute(
    `UPDATE gc_customers
     SET paystack_subscription_code = ?, paystack_plan_code = ?
     WHERE user_id = ?`,
    [toEnable.subscription_code, toEnable.plan.plan_code, userId]
  );

  return res.status(200).json({ success: true });
}

export default withErrorReporting(handler);
