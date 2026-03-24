import { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import withErrorReporting from "@/error/withErrorReporting";
import { connect } from "@planetscale/database";
import { listCustomerSubscriptions, disableSubscription } from "@/utils/paystack";
import { getCustomerCodeFromUserId } from "@/utils/subscription";

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
    return res.status(404).json({ error: "No subscription found" });
  }

  const subscriptions = await listCustomerSubscriptions(customerCode);
  const active = subscriptions.find((s) => s.status === "active");
  if (!active) {
    return res.status(404).json({ error: "No active subscription found" });
  }

  if (!active.email_token) {
    return res.status(500).json({ error: "Cannot cancel subscription: missing email token" });
  }

  const disabled = await disableSubscription(active.subscription_code, active.email_token);
  if (!disabled) {
    return res.status(500).json({ error: "Failed to cancel subscription via PayStack" });
  }

  // Remove the subscription code from gc_customers so the user appears as cancelled
  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });
  await conn.execute(
    "UPDATE gc_customers SET paystack_subscription_code = NULL WHERE user_id = ?",
    [userId]
  );

  return res.status(200).json({ success: true });
}

export default withErrorReporting(handler);
