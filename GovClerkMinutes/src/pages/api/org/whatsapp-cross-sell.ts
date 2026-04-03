import { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import { connect } from "@planetscale/database";
import withErrorReporting from "@/error/withErrorReporting";

type WhatsappCrossSellRequest = {
  orgId: string;
  orgName: string;
  phone: string;
};

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ success: boolean } | { error: string }>
) {
  if (req.method !== "POST") {return res.status(405).json({ error: "Method not allowed" });}

  const { userId } = getAuth(req);
  if (!userId) {return res.status(401).json({ error: "Unauthorized" });}

  const { orgId, orgName, phone } = req.body as WhatsappCrossSellRequest;

  if (!orgId || !orgName || !phone) {
    return res.status(400).json({ error: "orgId, orgName, and phone are required" });
  }

  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  // Create cross-sell session record
  await conn.execute(
    `INSERT INTO gc_cross_sell_sessions (org_id, org_name, phone, state, last_message_at, created_at)
     VALUES (?, ?, ?, 'entry', NOW(), NOW())
     ON DUPLICATE KEY UPDATE state = 'entry', last_message_at = NOW()`,
    [orgId, orgName, phone]
  );

  // Send initial Samantha WhatsApp message via WhatsApp Cloud API
  const businessPhoneNumberId = "1088830760969865"; // 27664259236 (GovClerk support number)
  const apiVersion = "v23.0";
  const message = `Hey ${orgName}, nice to finally meet you! I noticed you're running low on streaming hours and want to try our Minutes generation — is that correct? Reply Yes or No 😊`;

  const waRes = await fetch(
    `https://graph.facebook.com/${apiVersion}/${businessPhoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.META_WHATSAPP_BUSINESS_API_KEY}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        type: "text",
        to: phone,
        text: {
          preview_url: false,
          body: message,
        },
      }),
    }
  );

  if (!waRes.ok) {
    const errText = await waRes.text().catch(() => "");
    console.error(`[whatsapp-cross-sell] Failed to send message: ${waRes.status} ${errText}`);
    // Don't fail the request — session was created; message can be retried
  }

  return res.status(200).json({ success: true });
}

export default withErrorReporting(handler);
