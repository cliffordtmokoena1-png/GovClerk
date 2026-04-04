import { assertString } from "./assert";

const POSTMARK_API_URL = "https://api.postmarkapp.com/email";
const POSTMARK_TEMPLATE_API_URL = "https://api.postmarkapp.com/email/withTemplate";

const GET_STARTED_GUIDE_URL =
  "https://help.GovClerkMinutes.com/en/articles/11072152-getting-started-with-GovClerkMinutes";
const HOW_TO_GET_BACK_GUIDE_URL =
  "https://help.GovClerkMinutes.com/en/articles/9176366-how-to-get-back-to-GovClerkMinutes-com";

const FROM_ADMIN = '"GovClerk Minutes" <admin@govclerkminutes.com>';
export const FROM_SALES = '"GovClerk Minutes Sales" <sales@govclerkminutes.com>';
const FROM_SUPPORT = '"GovClerk Minutes Support" <support@govclerkminutes.com>';

export type SendEmailParams = {
  From: string;
  To: string;
  Cc?: string[];
  Bcc?: string[];
  Subject: string;
  HtmlBody: string;
  TextBody: string;
  MessageStream: string;
  Attachments?: Array<{
    Name: string;
    Content: string;
    ContentType: string;
    ContentID?: string;
    Disposition?: string;
  }>;
};

export type SendEmailWithTemplateParams = {
  From: string;
  To: string;
  TemplateAlias: string;
  TemplateModel: Record<string, string | number | boolean>;
  MessageStream: string;
};

export async function sendEmailWithTemplate({
  From,
  To,
  TemplateAlias,
  TemplateModel,
  MessageStream,
}: SendEmailWithTemplateParams) {
  const res = await fetch(POSTMARK_TEMPLATE_API_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Postmark-Server-Token": assertString(process.env.POSTMARK_SERVER_TOKEN),
    },
    body: JSON.stringify({
      From,
      To,
      TemplateAlias,
      TemplateModel,
      MessageStream,
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    console.error("Postmark Template API Error:", error);
    throw new Error(`Failed to send template email via Postmark: ${res.status}`);
  }
}

export async function sendEmail({
  From,
  To,
  Cc,
  Bcc,
  Subject,
  HtmlBody,
  TextBody,
  MessageStream,
  Attachments,
}: SendEmailParams) {
  const res = await fetch(POSTMARK_API_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Postmark-Server-Token": assertString(process.env.POSTMARK_SERVER_TOKEN),
    },
    body: JSON.stringify({
      From,
      To,
      Cc: Cc?.join(","),
      Bcc: Bcc?.join(","),
      Subject,
      HtmlBody,
      TextBody,
      MessageStream,
      Attachments,
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    console.error("Postmark API Error:", error);
    throw new Error(`Failed to send email via Postmark: ${res.status}`);
  }
}

const MAX_EMAIL_RETRY_ATTEMPTS = 2;

export async function sendWelcomeEmail(email: string, firstName?: string) {
  const params = {
    From: FROM_ADMIN,
    To: email,
    TemplateAlias: "govclerk-welcome",
    TemplateModel: {
      first_name: firstName ?? "there",
      dashboard_url: "https://govclerkminutes.com/dashboard?utm_medium=email",
      get_started_url: GET_STARTED_GUIDE_URL,
      support_email: "support@govclerkminutes.com",
      company_name: "GovClerk Minutes",
      current_year: new Date().getFullYear().toString(),
    },
    MessageStream: "signup_and_purchase",
  };

  for (let attempt = 1; attempt <= MAX_EMAIL_RETRY_ATTEMPTS; attempt++) {
    try {
      await sendEmailWithTemplate(params);
      console.info(`[sendWelcomeEmail] Welcome email sent to ${email} (attempt ${attempt})`);
      return;
    } catch (err) {
      console.error(
        `[sendWelcomeEmail] Failed to send welcome email to ${email} (attempt ${attempt}):`,
        err
      );
      if (attempt === MAX_EMAIL_RETRY_ATTEMPTS) {
        console.error(`[sendWelcomeEmail] Exhausted retries for ${email}`);
      }
    }
  }
}

export async function sendSignUpMagicEmail(email: string, token: string) {
  await sendEmail({
    From: FROM_ADMIN,
    To: email,
    Subject: "Welcome to GovClerk Minutes — Complete Your Account Setup",
    HtmlBody: `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head><body style="margin:0;padding:0;background-color:#f4f6f9;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9;padding:40px 0;"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);"><tr><td style="background-color:#1a3c6e;padding:28px 40px;text-align:center;"><h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:600;letter-spacing:0.5px;">GovClerk Minutes</h1></td></tr><tr><td style="padding:40px 40px 32px;"><p style="margin:0 0 16px;font-size:16px;color:#2d3748;">Welcome aboard,</p><p style="margin:0 0 16px;font-size:15px;color:#4a5568;line-height:1.7;">Thank you for creating your GovClerk Minutes account. We're delighted to have you with us — our platform is purpose-built to help government clerks and municipal professionals produce accurate, professional meeting minutes with ease.</p><p style="margin:0 0 24px;font-size:15px;color:#4a5568;line-height:1.7;">To complete your account setup and access your dashboard, please click the button below:</p><p style="text-align:center;margin:0 0 28px;"><a href="https://govclerkminutes.com/accept-token/${token}?utm_medium=email" style="display:inline-block;padding:14px 32px;background-color:#1a3c6e;color:#ffffff;text-decoration:none;border-radius:6px;font-size:15px;font-weight:600;letter-spacing:0.3px;">Complete Account Setup →</a></p><p style="margin:0 0 16px;font-size:15px;color:#4a5568;line-height:1.7;">Once you're in, we recommend starting with our <a href="${GET_STARTED_GUIDE_URL}" style="color:#1a3c6e;font-weight:600;">Getting Started Guide</a> — it will walk you through uploading your first recording and generating your first set of minutes.</p><p style="margin:0 0 8px;font-size:15px;color:#4a5568;">If you have any questions at any time, our support team is always happy to help at <a href="mailto:support@govclerkminutes.com" style="color:#1a3c6e;">support@govclerkminutes.com</a>.</p><p style="margin:24px 0 0;font-size:15px;color:#2d3748;">Warm regards,<br/><strong>Cliff Mokoena</strong><br/><span style="color:#8a94a6;font-size:13px;">Founder, GovClerk Minutes</span></p></td></tr><tr><td style="background-color:#f8f9fb;padding:20px 40px;border-top:1px solid #e8ecf0;text-align:center;"><p style="margin:0;font-size:12px;color:#8a94a6;">GovClerk Minutes · <a href="https://govclerkminutes.com" style="color:#1a3c6e;text-decoration:none;">govclerkminutes.com</a><br/>Questions? Email us at <a href="mailto:support@govclerkminutes.com" style="color:#1a3c6e;text-decoration:none;">support@govclerkminutes.com</a></p></td></tr></table></td></tr></table></body></html>`,
    TextBody: `Welcome aboard,\n\nThank you for creating your GovClerk Minutes account. We're delighted to have you with us.\n\nTo complete your account setup and access your dashboard, paste this link into your browser:\nhttps://govclerkminutes.com/accept-token/${token}\n\nOnce you're in, we recommend starting with our Getting Started Guide:\n${GET_STARTED_GUIDE_URL}\n\nIf you have any questions, our support team is always happy to help at support@govclerkminutes.com.\n\nWarm regards,\nCliff Mokoena\nFounder, GovClerk Minutes\ngovclerkminutes.com`,
    MessageStream: "signup_and_purchase",
  });
}

export async function sendSignInMagicEmail(email: string, token: string) {
  await sendEmail({
    From: FROM_ADMIN,
    To: email,
    Subject: "Your GovClerk Minutes Sign-In Link",
    HtmlBody: `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head><body style="margin:0;padding:0;background-color:#f4f6f9;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9;padding:40px 0;"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);"><tr><td style="background-color:#1a3c6e;padding:28px 40px;text-align:center;"><h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:600;letter-spacing:0.5px;">GovClerk Minutes</h1></td></tr><tr><td style="padding:40px 40px 32px;"><p style="margin:0 0 16px;font-size:16px;color:#2d3748;">Welcome back,</p><p style="margin:0 0 16px;font-size:15px;color:#4a5568;line-height:1.7;">We received a sign-in request for your GovClerk Minutes account. Click the button below to sign in securely — this link is valid for 20 minutes.</p><p style="text-align:center;margin:0 0 28px;"><a href="https://govclerkminutes.com/accept-token/${token}?utm_medium=email" style="display:inline-block;padding:14px 32px;background-color:#1a3c6e;color:#ffffff;text-decoration:none;border-radius:6px;font-size:15px;font-weight:600;letter-spacing:0.3px;">Sign In to Your Account →</a></p><p style="margin:0 0 16px;font-size:15px;color:#4a5568;line-height:1.7;">If you did not request this link, you can safely ignore this email — no changes have been made to your account.</p><p style="margin:0 0 8px;font-size:15px;color:#4a5568;">For faster access in future, consider bookmarking your dashboard. Our guide on <a href="${HOW_TO_GET_BACK_GUIDE_URL}" style="color:#1a3c6e;font-weight:600;">saving a shortcut</a> can help.</p><p style="margin:24px 0 0;font-size:15px;color:#2d3748;">Warm regards,<br/><strong>Cliff Mokoena</strong><br/><span style="color:#8a94a6;font-size:13px;">Founder, GovClerk Minutes</span></p></td></tr><tr><td style="background-color:#f8f9fb;padding:20px 40px;border-top:1px solid #e8ecf0;text-align:center;"><p style="margin:0;font-size:12px;color:#8a94a6;">GovClerk Minutes · <a href="https://govclerkminutes.com" style="color:#1a3c6e;text-decoration:none;">govclerkminutes.com</a><br/>Questions? Email us at <a href="mailto:support@govclerkminutes.com" style="color:#1a3c6e;text-decoration:none;">support@govclerkminutes.com</a></p></td></tr></table></td></tr></table></body></html>`,
    TextBody: `Welcome back,\n\nWe received a sign-in request for your GovClerk Minutes account. Paste this link into your browser to sign in securely (valid for 20 minutes):\nhttps://govclerkminutes.com/accept-token/${token}\n\nIf you did not request this link, you can safely ignore this email.\n\nFor faster access in future, our guide on saving a shortcut: ${HOW_TO_GET_BACK_GUIDE_URL}\n\nWarm regards,\nCliff Mokoena\nFounder, GovClerk Minutes\ngovclerkminutes.com`,
    MessageStream: "signup_and_purchase",
  });
}

export async function sendPaymentConfirmationEmail(
  email: string,
  planName: string,
  firstName?: string | null
) {
  await sendEmailWithTemplate({
    From: FROM_ADMIN,
    To: email,
    TemplateAlias: "govclerk-payment-confirmation",
    TemplateModel: {
      first_name: firstName ?? "there",
      plan_name: planName,
      dashboard_url: "https://govclerkminutes.com/dashboard?utm_medium=email",
      support_email: "support@govclerkminutes.com",
      company_name: "GovClerk Minutes",
      current_year: new Date().getFullYear().toString(),
    },
    MessageStream: "signup_and_purchase",
  });
}

/** Minimal RFC-5322 email format check. */
export function isValidEmailFormat(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

export async function sendSupportEmail({
  toEmail,
  fromUserEmail,
  subject,
  messageHtml,
  messageText,
}: {
  toEmail: string;
  fromUserEmail: string;
  subject: string;
  messageHtml: string;
  messageText: string;
}) {
  await sendEmail({
    From: FROM_SUPPORT,
    To: toEmail,
    Bcc: [fromUserEmail],
    Subject: subject,
    HtmlBody: messageHtml,
    TextBody: messageText,
    MessageStream: "outbound",
  });
}
