import { NextApiRequest, NextApiResponse } from "next";
import { connect } from "@planetscale/database";
import { WHATSAPP_API_VERSION, getPhoneNumberIdFor } from "@/admin/whatsapp/api/consts";
import { SUPPORT_WHATSAPP_NUMBER } from "@/utils/whatsapp";
import withErrorReporting from "@/error/withErrorReporting";

const ONE_HOUR_MS = 60 * 60 * 1000;

const RE_ENGAGE_MESSAGE = (orgName: string) =>
  `Hey ${orgName} 👋 Still there? I know things get busy, but I'd hate for your meetings to be disrupted by running out of hours. Even just a quick top-up or trying GovClerkMinutes could save the day! Can I help you sort this out? 😊`;

async function handler(req: NextApiRequest, res: NextApiResponse<{ ok: boolean } | { error: string }>) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Verify cron secret to prevent unauthorized calls
  const authHeader = req.headers.authorization;
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  // Find sessions that are still active and haven't been messaged in > 1 hour
  const oneHourAgo = new Date(Date.now() - ONE_HOUR_MS)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");

  const sessions = await conn
    .execute(
      "SELECT id, org_id, org_name, phone FROM gc_cross_sell_sessions WHERE state != 'done' AND last_message_at < ?",
      [oneHourAgo]
    )
    .then((r) => r.rows as { id: number; org_id: string; org_name: string; phone: string }[])
    .catch(() => [] as { id: number; org_id: string; org_name: string; phone: string }[]);

  if (sessions.length === 0) {
    return res.status(200).json({ ok: true });
  }

  const businessPhoneNumberId = getPhoneNumberIdFor(SUPPORT_WHATSAPP_NUMBER);

  for (const session of sessions) {
    try {
      const message = RE_ENGAGE_MESSAGE(session.org_name ?? "there");

      await fetch(
        `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${businessPhoneNumberId}/messages`,
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
            to: session.phone,
            text: { preview_url: false, body: message },
          }),
        }
      );

      await conn.execute(
        "UPDATE gc_cross_sell_sessions SET state = 're_engage', last_message_at = NOW() WHERE id = ?",
        [session.id]
      );
    } catch (err) {
      console.error(`[cross-sell-reengage] Failed for session ${session.id}:`, err);
    }
  }

  return res.status(200).json({ ok: true });
}

export default withErrorReporting(handler);
