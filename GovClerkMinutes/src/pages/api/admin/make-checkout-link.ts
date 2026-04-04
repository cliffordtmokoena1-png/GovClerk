import { getAuth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import withErrorReporting from "@/error/withErrorReporting";
import { withServiceAccountOrAdminAuth } from "@/utils/serviceAccountAuth";
import { assertString } from "@/utils/assert";
import { assertEnvironment } from "@/utils/environment";
import { getUserIdFromEmail } from "@/auth/getUserIdFromEmail";
import getPrimaryEmail from "@/utils/email";
import { sendEmail } from "@/utils/postmark";
import type { PaidSubscriptionPlan } from "@/utils/price";
import { HUBSPOT_OWNER_IDS, OUTGOING_BCC_EMAIL } from "@/crm/hubspot/consts";
import hubspot from "@/crm/hubspot";
import { getSiteFromHeaders } from "@/utils/site";

export const config = {
  runtime: "edge",
};

type RequestBody = {
  email: string;
  env: string;
  country: string;
  plan: PaidSubscriptionPlan | string;
  sendInEmail?: boolean;
};

const VALID_COUNTRIES = new Set(["ZA", "US", "IN", "PH"]);
// TODO: support Lite plan better
const VALID_PLANS = new Set<PaidSubscriptionPlan | "Lite">([
  "Lite",
  "Essential",
  "Essential_Annual",
  "Professional",
  "Professional_Annual",
  "Elite",
  "Elite_Annual",
  "Premium",
  "Premium_Annual",
  // Legacy plans kept for backward compatibility
  "Basic",
  "Basic_Annual",
  "Pro",
  "Pro_Annual",
]);

async function handler(req: NextRequest) {
  const persona = req.headers.get("x-service-account-persona");
  if (persona) {
    console.log(`[admin/make-checkout-link] Called by service account: ${persona}`);
  }

  // Get admin user ID — may be null when called via service account
  const { userId: adminUserId } = getAuth(req);

  try {
    const body = (await req.json()) as RequestBody;
    const customerEmail = assertString(body.email);
    const env = assertEnvironment(body.env);
    let country = assertString(body.country);
    const plan = assertString(body.plan) as PaidSubscriptionPlan;
    const sendInEmail = Boolean(body.sendInEmail);

    if (!VALID_COUNTRIES.has(country)) {
      return json(
        {
          error: `Unsupported country code: ${country}. Supported values: ${[...VALID_COUNTRIES].join(", ")}`,
        },
        400
      );
    }

    if (!VALID_PLANS.has(plan)) {
      return json({ error: "Invalid plan" }, 400);
    }

    const site = getSiteFromHeaders(req.headers);
    const userId = await getUserIdFromEmail({ email: customerEmail, env, site });
    if (userId == null) {
      return json({ error: "User not found" }, 404);
    }

    const origin = req.nextUrl.origin;
    const url = `${origin}/subscribe/${country}/${plan}/${userId}`;

    if (sendInEmail) {
      const operator = HUBSPOT_OWNER_IDS.CLIFF_MOKOENA;
      const contact = await hubspot.getContact({
        filter: {
          propertyName: "user_id",
          value: userId,
        },
        returnedProperties: ["firstname"],
      });
      const customerName = contact?.properties.firstname ?? "there";

      let fromEmail = operator.email;
      if (adminUserId) {
        const fetchedEmail = (await getPrimaryEmail(adminUserId, site)) ?? operator.email;
        if (fetchedEmail.includes("@GovClerkMinutes.com")) {
          fromEmail = fetchedEmail;
        }
      }

      const HtmlBody = `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head><body style="margin:0;padding:0;background-color:#f4f6f9;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9;padding:40px 0;"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);"><tr><td style="background-color:#1a3c6e;padding:28px 40px;text-align:center;"><h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:600;letter-spacing:0.5px;">GovClerk Minutes</h1></td></tr><tr><td style="padding:40px 40px 32px;"><p style="margin:0 0 16px;font-size:16px;color:#2d3748;">Hi ${customerName},</p><p style="margin:0 0 16px;font-size:15px;color:#4a5568;line-height:1.7;">Thank you for your interest in GovClerk Minutes. I have prepared your personalised subscription link — please use the button below to complete your plan activation at your convenience.</p><p style="text-align:center;margin:0 0 28px;"><a href="${url}" style="display:inline-block;padding:14px 32px;background-color:#1a3c6e;color:#ffffff;text-decoration:none;border-radius:6px;font-size:15px;font-weight:600;letter-spacing:0.3px;">Activate My Subscription →</a></p><p style="margin:0 0 16px;font-size:15px;color:#4a5568;line-height:1.7;">Once your subscription is active, you will have full access to our AI-powered transcription and meeting minutes generation tools — purpose-built for government and municipal professionals.</p><p style="margin:0 0 8px;font-size:15px;color:#4a5568;line-height:1.7;">If the button above does not work, you can copy and paste this link directly into your browser:<br/><a href="${url}" style="color:#1a3c6e;word-break:break-all;">${url}</a></p><p style="margin:0 0 8px;font-size:15px;color:#4a5568;">Please feel free to reply to this email if you have any questions — I am happy to assist.</p><p style="margin:24px 0 0;font-size:15px;color:#2d3748;">Kind regards,<br/><strong>${operator.firstname}</strong><br/><span style="color:#8a94a6;font-size:13px;">Sales, GovClerk Minutes</span></p></td></tr><tr><td style="background-color:#f8f9fb;padding:20px 40px;border-top:1px solid #e8ecf0;text-align:center;"><p style="margin:0;font-size:12px;color:#8a94a6;">GovClerk Minutes · <a href="https://govclerkminutes.com" style="color:#1a3c6e;text-decoration:none;">govclerkminutes.com</a><br/>Questions? Email us at <a href="mailto:support@govclerkminutes.com" style="color:#1a3c6e;text-decoration:none;">support@govclerkminutes.com</a></p></td></tr></table></td></tr></table></body></html>`;
      const TextBody = `Hi ${customerName},\n\nThank you for your interest in GovClerk Minutes. I have prepared your personalised subscription link — please use the link below to complete your plan activation at your convenience.\n\n${url}\n\nOnce your subscription is active, you will have full access to our AI-powered transcription and meeting minutes generation tools.\n\nIf you have any questions, please feel free to reply to this email — I am happy to assist.\n\nKind regards,\n${operator.firstname}\nSales, GovClerk Minutes\ngovclerkminutes.com`;

      await sendEmail({
        From: `"${operator.name()}" <${fromEmail}>`,
        To: customerEmail,
        Subject: "Your GovClerk Minutes Subscription Link — Action Required",
        Bcc: [OUTGOING_BCC_EMAIL],
        HtmlBody,
        TextBody,
        MessageStream: "transactional",
      });
    }

    return json({ url, emailed: sendInEmail }, 200);
  } catch (error) {
    console.error("[admin/make-checkout-link] Handler error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return json({ error: message }, 500);
  }
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default withErrorReporting(withServiceAccountOrAdminAuth(handler));
