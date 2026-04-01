import { assertString } from "./assert";

const POSTMARK_API_URL = "https://api.postmarkapp.com/email";

const GET_STARTED_GUIDE_URL =
  "https://help.GovClerkMinutes.com/en/articles/11072152-getting-started-with-GovClerkMinutes";
const HOW_TO_GET_BACK_GUIDE_URL =
  "https://help.GovClerkMinutes.com/en/articles/9176366-how-to-get-back-to-GovClerkMinutes-com";

const FROM_ADMIN = '"GovClerk Minutes" <admin@govclerkminutes.com>';
const FROM_SALES = '"GovClerk Minutes" <sales@govclerkminutes.com>';
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
  const greeting = firstName ? `Hi ${firstName},` : "Hi there,";
  const params = {
    From: FROM_ADMIN,
    To: email,
    Subject: "Welcome to GovClerk Minutes!",
    HtmlBody: `<p>${greeting}</p><p>Welcome to <a href='https://govclerkminutes.com?utm_medium=email'>GovClerk Minutes</a>! We're thrilled to have you on board.</p><p>To get started, head to your dashboard and upload an audio or video recording of a meeting — we'll automatically generate your meeting minutes.</p><p><a href='https://govclerkminutes.com/dashboard?utm_medium=email' style='display:inline-block;padding:10px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;'>Go to Dashboard</a></p><p>If you have any questions or need help getting started, don't hesitate to reach out.</p><p>Best regards,<br />Cliff<br />GovClerk Minutes</p>`,
    TextBody: `${greeting}\n\nWelcome to GovClerk Minutes! We're thrilled to have you on board.\n\nTo get started, head to your dashboard and upload an audio or video recording of a meeting — we'll automatically generate your meeting minutes.\n\nGo to your dashboard: https://govclerkminutes.com/dashboard\n\nIf you have any questions or need help getting started, don't hesitate to reach out.\n\nBest regards,\nCliff\nGovClerk Minutes`,
    MessageStream: "signup_and_purchase",
  };

  for (let attempt = 1; attempt <= MAX_EMAIL_RETRY_ATTEMPTS; attempt++) {
    try {
      await sendEmail(params);
      console.info(`[sendWelcomeEmail] Welcome email sent to ${email} (attempt ${attempt})`);
      return;
    } catch (err) {
      console.error(`[sendWelcomeEmail] Failed to send welcome email to ${email} (attempt ${attempt}):`, err);
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
    Subject: "Your GovClerk Minutes sign-up link",
    HtmlBody: `<p>Thanks for creating an account with GovClerk Minutes!</p><p>Click the button below to complete your sign-up and access your dashboard:</p><p><a href='https://govclerkminutes.com/accept-token/${token}?utm_medium=email' style='display:inline-block;padding:10px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;'>Complete Sign-Up</a></p><p>After signing in, read our <a href="${GET_STARTED_GUIDE_URL}">guide on getting started</a> to make the most of GovClerk Minutes.</p><p>Best regards,<br />GovClerk Minutes</p>`,
    TextBody: `Thanks for creating an account with GovClerk Minutes!\n\nPaste this link into your browser to complete your sign-up: https://govclerkminutes.com/accept-token/${token}\n\nAfter signing in, read our guide to getting started at ${GET_STARTED_GUIDE_URL}.`,
    MessageStream: "signup_and_purchase",
  });
}

export async function sendSignInMagicEmail(email: string, token: string) {
  await sendEmail({
    From: FROM_ADMIN,
    To: email,
    Subject: "Your GovClerk Minutes sign-in link",
    HtmlBody: `<p>Welcome back to GovClerk Minutes!</p><p>Click the button below to sign in to your account:</p><p><a href='https://govclerkminutes.com/accept-token/${token}?utm_medium=email' style='display:inline-block;padding:10px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;'>Sign In</a></p><p>After signing in, read our <a href="${HOW_TO_GET_BACK_GUIDE_URL}">guide on saving a shortcut to get back easier</a>.</p><p>Best regards,<br />GovClerk Minutes</p>`,
    TextBody: `Welcome back to GovClerk Minutes!\n\nPaste this link into your browser to sign in: https://govclerkminutes.com/accept-token/${token}\n\nAfter signing in, read our guide on saving a shortcut to get back easier: ${HOW_TO_GET_BACK_GUIDE_URL}.`,
    MessageStream: "signup_and_purchase",
  });
}

export async function sendPaymentConfirmationEmail(
  email: string,
  planName: string,
  firstName?: string | null
) {
  const greeting = firstName ? `Hi ${firstName},` : "Hi there,";
  await sendEmail({
    From: FROM_SALES,
    To: email,
    Subject: `Your ${planName} subscription is now active!`,
    HtmlBody: `<p>${greeting}</p><p>Thank you for subscribing to <strong>GovClerk Minutes ${planName}</strong>! Your plan is now active and your credits have been added to your account.</p><p><a href='https://govclerkminutes.com/dashboard?utm_medium=email' style='display:inline-block;padding:10px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;'>Go to Dashboard</a></p><p>If you have any questions or need help, simply reply to this email and our support team will be happy to assist.</p><p>Best regards,<br />GovClerk Minutes</p>`,
    TextBody: `${greeting}\n\nThank you for subscribing to GovClerk Minutes ${planName}! Your plan is now active and your credits have been added to your account.\n\nGo to your dashboard: https://govclerkminutes.com/dashboard\n\nIf you have any questions or need help, simply reply to this email and our support team will be happy to assist.\n\nBest regards,\nGovClerk Minutes`,
    MessageStream: "signup_and_purchase",
  });
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
