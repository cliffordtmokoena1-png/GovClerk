import type { NextApiRequest, NextApiResponse } from "next";
import withErrorReporting from "@/error/withErrorReporting";

export const config = {
  api: {
    bodyParser: true,
  },
};

/**
 * Postmark Inbound Email Webhook
 * Receives emails sent to support@govclerkminutes.com and logs/forwards them.
 * Configure in Postmark: Default Inbound Stream → Webhook URL → https://govclerkminutes.com/api/webhook/postmark-inbound
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const payload = req.body;

  console.info("[postmark-inbound] Received inbound email:", {
    from: payload?.From,
    to: payload?.To,
    subject: payload?.Subject,
    messageId: payload?.MessageID,
  });

  // TODO: Route to support ticket system, forward to internal inbox, or store in DB
  // For now, log the inbound email so it is visible in Vercel logs
  console.info("[postmark-inbound] Full payload:", JSON.stringify(payload, null, 2));

  return res.status(200).json({ received: true });
}

export default withErrorReporting(handler);
