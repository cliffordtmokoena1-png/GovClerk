/**
 * GovClerk Portal branded email functions.
 *
 * These emails are visually and tonally DISTINCT from GovClerkMinutes emails:
 * - Header colour: #0d5e3a (deep civic green) vs #1a3c6e (navy) for GovClerkMinutes
 * - Brand name: "GovClerk Portal" vs "GovClerk Minutes"
 * - Sender: admin@govclerkminutes.com (display name "GovClerk Portal") vs admin@govclerkminutes.com (display name "GovClerk Minutes")
 * - Tone: civic, transparent, community-focused vs productivity/professional
 * - Sign-off: "The GovClerk Portal Team" vs "Cliff Mokoena, Founder, GovClerk Minutes"
 */

import { sendEmail } from "./postmark";
import { getPortalDbConnection } from "./portalDb";

const FROM_PORTAL = '"GovClerk Portal" <admin@govclerkminutes.com>';
const PORTAL_GREEN = "#0d5e3a";

/**
 * Send a branded GovClerk Portal verification email with a 6-digit code.
 *
 * @param email     Recipient email address
 * @param code      6-digit verification code
 * @param orgName   Optional organisation name to personalise the body
 */
export async function sendPortalVerificationEmail(
  email: string,
  code: string,
  orgName?: string
): Promise<void> {
  const orgLabel = orgName ? `your registration for ${orgName}` : "your registration for the portal";

  const htmlBody = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9;padding:40px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
      <!-- Header -->
      <tr>
        <td style="background-color:${PORTAL_GREEN};padding:28px 40px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:600;letter-spacing:0.5px;">GovClerk Portal</h1>
        </td>
      </tr>
      <!-- Body -->
      <tr>
        <td style="padding:40px 40px 32px;">
          <p style="margin:0 0 16px;font-size:16px;color:#2d3748;">Hello,</p>
          <p style="margin:0 0 20px;font-size:15px;color:#4a5568;line-height:1.7;">To complete ${orgLabel}, please enter the following verification code:</p>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" style="padding:24px 0;">
                <h2 style="margin:0;letter-spacing:0.5em;font-size:2.5rem;color:${PORTAL_GREEN};font-weight:700;font-family:'Courier New',Courier,monospace;background:#f0faf5;border-radius:8px;padding:20px 32px;display:inline-block;">${code}</h2>
              </td>
            </tr>
          </table>
          <p style="margin:0 0 12px;font-size:14px;color:#718096;text-align:center;">This code expires in <strong>15 minutes</strong>.</p>
          <p style="margin:0 0 32px;font-size:14px;color:#a0aec0;text-align:center;">If you didn't request this, you can safely ignore this email.</p>
          <p style="margin:24px 0 0;font-size:15px;color:#2d3748;">Yours in public service,<br/><strong>The GovClerk Portal Team</strong></p>
        </td>
      </tr>
      <!-- Footer -->
      <tr>
        <td style="background-color:#f8f9fb;padding:20px 40px;border-top:1px solid #e8ecf0;text-align:center;">
          <p style="margin:0;font-size:12px;color:#8a94a6;">GovClerk Portal &middot; Powered by GovClerk Minutes &middot; <a href="https://govclerkminutes.com" style="color:${PORTAL_GREEN};text-decoration:none;">govclerkminutes.com</a></p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  const textBody = `Hello,

To complete ${orgLabel}, please enter the following verification code:

  ${code}

This code expires in 15 minutes.

If you didn't request this, you can safely ignore this email.

Yours in public service,
The GovClerk Portal Team

GovClerk Portal · Powered by GovClerk Minutes · govclerkminutes.com`;

  await sendEmail({
    From: FROM_PORTAL,
    To: email,
    Subject: "Your GovClerk Portal Verification Code",
    HtmlBody: htmlBody,
    TextBody: textBody,
    MessageStream: "portal-verification",
  });
}

/**
 * Send a branded GovClerk Portal welcome email after successful email verification.
 *
 * @param email       Recipient email address
 * @param firstName   Optional first name to personalise the greeting
 * @param portalSlug  Optional portal slug for the CTA link
 */
export async function sendPortalWelcomeEmail(
  email: string,
  firstName?: string,
  portalSlug?: string
): Promise<void> {
  const greeting = firstName ? `Welcome, ${firstName}!` : "Welcome!";
  const portalUrl = portalSlug
    ? `https://govclerkminutes.com/portal/${portalSlug}`
    : "https://govclerkminutes.com";

  const htmlBody = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9;padding:40px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
      <!-- Header -->
      <tr>
        <td style="background-color:${PORTAL_GREEN};padding:28px 40px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:600;letter-spacing:0.5px;">GovClerk Portal</h1>
        </td>
      </tr>
      <!-- Body -->
      <tr>
        <td style="padding:40px 40px 32px;">
          <p style="margin:0 0 16px;font-size:20px;font-weight:600;color:#2d3748;">${greeting}</p>
          <p style="margin:0 0 20px;font-size:15px;color:#4a5568;line-height:1.7;">Your email has been verified and your GovClerk Portal account is now active. You can now access meeting records, live broadcasts, agendas, and public documents through your organisation's portal.</p>
          <!-- CTA Button -->
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" style="padding:16px 0 32px;">
                <a href="${portalUrl}" style="display:inline-block;padding:14px 32px;background-color:${PORTAL_GREEN};color:#ffffff;text-decoration:none;border-radius:6px;font-size:15px;font-weight:600;letter-spacing:0.3px;">Go to Your Portal &rarr;</a>
              </td>
            </tr>
          </table>
          <!-- What you can do -->
          <p style="margin:0 0 12px;font-size:15px;font-weight:600;color:#2d3748;">What you can do:</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
            <tr><td style="padding:6px 0;font-size:14px;color:#4a5568;">&#10003;&nbsp;&nbsp;View upcoming meeting agendas</td></tr>
            <tr><td style="padding:6px 0;font-size:14px;color:#4a5568;">&#10003;&nbsp;&nbsp;Watch live meeting broadcasts</td></tr>
            <tr><td style="padding:6px 0;font-size:14px;color:#4a5568;">&#10003;&nbsp;&nbsp;Search meeting archives and transcripts</td></tr>
            <tr><td style="padding:6px 0;font-size:14px;color:#4a5568;">&#10003;&nbsp;&nbsp;Download official documents and minutes</td></tr>
          </table>
          <p style="margin:24px 0 0;font-size:15px;color:#2d3748;">Yours in public service,<br/><strong>The GovClerk Portal Team</strong></p>
        </td>
      </tr>
      <!-- Footer -->
      <tr>
        <td style="background-color:#f8f9fb;padding:20px 40px;border-top:1px solid #e8ecf0;text-align:center;">
          <p style="margin:0;font-size:12px;color:#8a94a6;">GovClerk Portal &middot; Powered by GovClerk Minutes &middot; <a href="https://govclerkminutes.com" style="color:${PORTAL_GREEN};text-decoration:none;">govclerkminutes.com</a></p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  const textBody = `${greeting}

Your email has been verified and your GovClerk Portal account is now active. You can now access meeting records, live broadcasts, agendas, and public documents through your organisation's portal.

Go to Your Portal: ${portalUrl}

What you can do:
- View upcoming meeting agendas
- Watch live meeting broadcasts
- Search meeting archives and transcripts
- Download official documents and minutes

Yours in public service,
The GovClerk Portal Team

GovClerk Portal · Powered by GovClerk Minutes · govclerkminutes.com`;

  await sendEmail({
    From: FROM_PORTAL,
    To: email,
    Subject: "Welcome to GovClerk Portal",
    HtmlBody: htmlBody,
    TextBody: textBody,
    MessageStream: "portal-transactional",
  });
}

/**
 * Send a branded GovClerk Portal password reset email.
 *
 * @param email       Recipient email address
 * @param resetToken  Secure random hex token to include in the reset link
 * @param slug        Portal slug used to construct the reset URL
 * @param orgName     Optional organisation name to personalise the body
 */
export async function sendPortalPasswordResetEmail(
  email: string,
  resetToken: string,
  slug: string,
  orgName?: string
): Promise<void> {
  const host = "govclerkminutes.com";
  const resetUrl = `https://${host}/portal/${slug}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;
  const orgLabel = orgName ? `your ${orgName} portal account` : "your portal account";

  const htmlBody = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9;padding:40px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
      <!-- Header -->
      <tr>
        <td style="background-color:${PORTAL_GREEN};padding:28px 40px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:600;letter-spacing:0.5px;">GovClerk Portal</h1>
        </td>
      </tr>
      <!-- Body -->
      <tr>
        <td style="padding:40px 40px 32px;">
          <p style="margin:0 0 16px;font-size:16px;color:#2d3748;">Hello,</p>
          <p style="margin:0 0 20px;font-size:15px;color:#4a5568;line-height:1.7;">We received a request to reset the password for ${orgLabel}. Click the button below to choose a new password:</p>
          <!-- CTA Button -->
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" style="padding:24px 0;">
                <a href="${resetUrl}" style="display:inline-block;padding:14px 32px;background-color:${PORTAL_GREEN};color:#ffffff;text-decoration:none;border-radius:6px;font-size:15px;font-weight:600;letter-spacing:0.3px;">Reset Password &rarr;</a>
              </td>
            </tr>
          </table>
          <p style="margin:0 0 12px;font-size:14px;color:#718096;text-align:center;">This link expires in <strong>1 hour</strong>.</p>
          <p style="margin:0 0 12px;font-size:14px;color:#718096;">If the button above doesn't work, copy and paste the following link into your browser:</p>
          <p style="margin:0 0 32px;font-size:13px;color:#4a5568;word-break:break-all;"><a href="${resetUrl}" style="color:${PORTAL_GREEN};">${resetUrl}</a></p>
          <p style="margin:0 0 32px;font-size:14px;color:#a0aec0;text-align:center;">If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
          <p style="margin:24px 0 0;font-size:15px;color:#2d3748;">Yours in public service,<br/><strong>The GovClerk Portal Team</strong></p>
        </td>
      </tr>
      <!-- Footer -->
      <tr>
        <td style="background-color:#f8f9fb;padding:20px 40px;border-top:1px solid #e8ecf0;text-align:center;">
          <p style="margin:0;font-size:12px;color:#8a94a6;">GovClerk Portal &middot; Powered by GovClerk Minutes &middot; <a href="https://govclerkminutes.com" style="color:${PORTAL_GREEN};text-decoration:none;">govclerkminutes.com</a></p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  const textBody = `Hello,

We received a request to reset the password for ${orgLabel}.

Click the link below to choose a new password:

  ${resetUrl}

This link expires in 1 hour.

If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.

Yours in public service,
The GovClerk Portal Team

GovClerk Portal · Powered by GovClerk Minutes · govclerkminutes.com`;

  await sendEmail({
    From: FROM_PORTAL,
    To: email,
    Subject: "Reset Your GovClerk Portal Password",
    HtmlBody: htmlBody,
    TextBody: textBody,
    MessageStream: "portal-transactional",
  });
}

/**
 * Send a cross-sell email when a Professional plan subscription is activated.
 * Informs the admin about their included GovClerkMinutes tokens and provides
 * a CTA to sign up or access their GovClerkMinutes dashboard.
 *
 * @param email      Recipient email address (organisation's primary admin)
 * @param firstName  Optional first name to personalise the greeting
 * @param orgName    Optional organisation name to personalise the body
 */
export async function sendPortalProfessionalCrossSellEmail(
  email: string,
  firstName?: string,
  orgName?: string
): Promise<void> {
  const greeting = firstName ? `${firstName},` : "Hello,";
  const orgLabel = orgName ? `for ${orgName}` : "";
  const dashboardUrl = "https://govclerkminutes.com/dashboard";
  const signupUrl = "https://govclerkminutes.com";

  const htmlBody = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9;padding:40px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
      <!-- Header -->
      <tr>
        <td style="background-color:${PORTAL_GREEN};padding:28px 40px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:600;letter-spacing:0.5px;">GovClerk Portal</h1>
        </td>
      </tr>
      <!-- Body -->
      <tr>
        <td style="padding:40px 40px 32px;">
          <p style="margin:0 0 16px;font-size:20px;font-weight:600;color:#2d3748;">${greeting}</p>
          <p style="margin:0 0 16px;font-size:15px;color:#4a5568;line-height:1.7;">Great news! Your GovClerk Portal <strong>Professional plan</strong> ${orgLabel} is now active.</p>
          <p style="margin:0 0 20px;font-size:15px;color:#4a5568;line-height:1.7;">As part of your Professional plan, you have <strong>2,000 GovClerkMinutes tokens included every month</strong>. These tokens let you generate AI-powered meeting minutes, transcriptions, and agendas directly from your recordings.</p>
          <!-- Token highlight box -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
            <tr>
              <td style="background-color:#f0faf5;border-left:4px solid ${PORTAL_GREEN};border-radius:4px;padding:16px 20px;">
                <p style="margin:0;font-size:15px;font-weight:600;color:#2d3748;">&#127381;&nbsp; 2,000 GovClerkMinutes tokens/month included</p>
                <p style="margin:8px 0 0;font-size:14px;color:#4a5568;">Your tokens are automatically credited to a GovClerkMinutes account linked to this email address. Sign in to your dashboard to access them.</p>
              </td>
            </tr>
          </table>
          <!-- CTA Buttons -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 32px;">
            <tr>
              <td align="center" style="padding:8px 0;">
                <a href="${dashboardUrl}" style="display:inline-block;padding:14px 32px;background-color:${PORTAL_GREEN};color:#ffffff;text-decoration:none;border-radius:6px;font-size:15px;font-weight:600;letter-spacing:0.3px;">Go to GovClerkMinutes Dashboard &rarr;</a>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:8px 0;">
                <p style="margin:0;font-size:13px;color:#718096;">Don&rsquo;t have an account yet? <a href="${signupUrl}" style="color:${PORTAL_GREEN};text-decoration:none;font-weight:600;">Sign up at govclerkminutes.com</a></p>
              </td>
            </tr>
          </table>
          <!-- What you can do -->
          <p style="margin:0 0 12px;font-size:15px;font-weight:600;color:#2d3748;">What you can do with your tokens:</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
            <tr><td style="padding:6px 0;font-size:14px;color:#4a5568;">&#10003;&nbsp;&nbsp;Generate AI meeting minutes from recordings</td></tr>
            <tr><td style="padding:6px 0;font-size:14px;color:#4a5568;">&#10003;&nbsp;&nbsp;Transcribe audio and video files with speaker identification</td></tr>
            <tr><td style="padding:6px 0;font-size:14px;color:#4a5568;">&#10003;&nbsp;&nbsp;Export minutes in DOCX and PDF formats</td></tr>
            <tr><td style="padding:6px 0;font-size:14px;color:#4a5568;">&#10003;&nbsp;&nbsp;Create and manage meeting agendas</td></tr>
          </table>
          <p style="margin:24px 0 0;font-size:15px;color:#2d3748;">Yours in public service,<br/><strong>The GovClerk Portal Team</strong></p>
        </td>
      </tr>
      <!-- Footer -->
      <tr>
        <td style="background-color:#f8f9fb;padding:20px 40px;border-top:1px solid #e8ecf0;text-align:center;">
          <p style="margin:0;font-size:12px;color:#8a94a6;">GovClerk Portal &middot; Powered by GovClerk Minutes &middot; <a href="https://govclerkminutes.com" style="color:${PORTAL_GREEN};text-decoration:none;">govclerkminutes.com</a></p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  const textBody = `${greeting}

Great news! Your GovClerk Portal Professional plan ${orgLabel} is now active.

As part of your Professional plan, you have 2,000 GovClerkMinutes tokens included every month. These tokens let you generate AI-powered meeting minutes, transcriptions, and agendas directly from your recordings.

🎉 2,000 GovClerkMinutes tokens/month included

Your tokens are automatically credited to a GovClerkMinutes account linked to this email address.

Go to your GovClerkMinutes Dashboard: ${dashboardUrl}

Don't have an account yet? Sign up at: ${signupUrl}

What you can do with your tokens:
- Generate AI meeting minutes from recordings
- Transcribe audio and video files with speaker identification
- Export minutes in DOCX and PDF formats
- Create and manage meeting agendas

Yours in public service,
The GovClerk Portal Team

GovClerk Portal · Powered by GovClerk Minutes · govclerkminutes.com`;

  await sendEmail({
    From: FROM_PORTAL,
    To: email,
    Subject: "Your GovClerk Portal Professional plan is active — claim your GovClerkMinutes tokens",
    HtmlBody: htmlBody,
    TextBody: textBody,
    MessageStream: "signup_and_purchase",
  });
}

/**
 * Send a branded GovClerk Portal payment failure email when a charge is declined.
 *
 * @param email      Recipient (admin) email address
 * @param orgName    Optional organisation name to personalise the body
 * @param amountZar  Optional amount that failed to be charged
 */
export async function sendPortalPaymentFailedEmail(
  email: string,
  orgName?: string,
  amountZar?: number
): Promise<void> {
  const orgLabel = orgName ? ` for ${orgName}` : "";
  const amountLine = amountZar
    ? `<p style="margin:0 0 20px;font-size:15px;color:#4a5568;line-height:1.7;">We were unable to process your payment of <strong>R${amountZar.toFixed(2)}</strong>${orgLabel}. Your GovClerk Portal plan has been paused until your payment details are updated.</p>`
    : `<p style="margin:0 0 20px;font-size:15px;color:#4a5568;line-height:1.7;">We were unable to process your GovClerk Portal payment${orgLabel}. Your plan has been paused until your payment details are updated.</p>`;

  const amountTextLine = amountZar
    ? `We were unable to process your payment of R${amountZar.toFixed(2)}${orgLabel}. Your GovClerk Portal plan has been paused until your payment details are updated.`
    : `We were unable to process your GovClerk Portal payment${orgLabel}. Your plan has been paused until your payment details are updated.`;

  const htmlBody = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9;padding:40px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
      <!-- Header -->
      <tr>
        <td style="background-color:${PORTAL_GREEN};padding:28px 40px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:600;letter-spacing:0.5px;">GovClerk Portal</h1>
        </td>
      </tr>
      <!-- Body -->
      <tr>
        <td style="padding:40px 40px 32px;">
          <p style="margin:0 0 16px;font-size:20px;font-weight:600;color:#c53030;">Action Required: Payment Could Not Be Processed</p>
          ${amountLine}
          <p style="margin:0 0 20px;font-size:15px;color:#4a5568;line-height:1.7;">To restore access to your portal, please update your payment method by contacting our team or visiting the billing section of your account.</p>
          <!-- CTA Button -->
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" style="padding:16px 0 32px;">
                <a href="mailto:support@govclerkminutes.com" style="display:inline-block;padding:14px 32px;background-color:${PORTAL_GREEN};color:#ffffff;text-decoration:none;border-radius:6px;font-size:15px;font-weight:600;letter-spacing:0.3px;">Contact Support &rarr;</a>
              </td>
            </tr>
          </table>
          <p style="margin:0 0 20px;font-size:14px;color:#718096;line-height:1.7;">If you believe this is an error, please reach out to us at <a href="mailto:support@govclerkminutes.com" style="color:${PORTAL_GREEN};">support@govclerkminutes.com</a> and we will assist you promptly.</p>
          <p style="margin:24px 0 0;font-size:15px;color:#2d3748;">Yours in public service,<br/><strong>The GovClerk Portal Team</strong></p>
        </td>
      </tr>
      <!-- Footer -->
      <tr>
        <td style="background-color:#f8f9fb;padding:20px 40px;border-top:1px solid #e8ecf0;text-align:center;">
          <p style="margin:0;font-size:12px;color:#8a94a6;">GovClerk Portal &middot; Powered by GovClerk Minutes &middot; <a href="https://govclerkminutes.com" style="color:${PORTAL_GREEN};text-decoration:none;">govclerkminutes.com</a></p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  const textBody = `Action Required: Payment Could Not Be Processed

${amountTextLine}

To restore access to your portal, please update your payment method by contacting our team or visiting the billing section of your account.

Contact Support: support@govclerkminutes.com

If you believe this is an error, please reach out to us at support@govclerkminutes.com and we will assist you promptly.

Yours in public service,
The GovClerk Portal Team

GovClerk Portal · Powered by GovClerk Minutes · govclerkminutes.com`;

  await sendEmail({
    From: FROM_PORTAL,
    To: email,
    Subject: "Action required: Your GovClerk Portal payment could not be processed",
    HtmlBody: htmlBody,
    TextBody: textBody,
    MessageStream: "signup_and_purchase",
  });
}

/**
 * Send a branded GovClerk Portal notification when a meeting agenda is published.
 *
 * @param email        Recipient email address
 * @param orgName      Organisation name
 * @param meetingTitle Title of the meeting
 * @param meetingDate  ISO date string of the meeting
 * @param portalUrl    Public portal URL for the meeting page
 */
export async function sendAgendaPublishedEmail(
  email: string,
  orgName: string,
  meetingTitle: string,
  meetingDate: string,
  portalUrl: string
): Promise<void> {
  const formattedDate = new Date(meetingDate).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const htmlBody = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9;padding:40px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
      <!-- Header -->
      <tr>
        <td style="background-color:${PORTAL_GREEN};padding:28px 40px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:600;letter-spacing:0.5px;">GovClerk Portal</h1>
          <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">${orgName}</p>
        </td>
      </tr>
      <!-- Body -->
      <tr>
        <td style="padding:40px 40px 32px;">
          <p style="margin:0 0 16px;font-size:16px;color:#2d3748;">Hello,</p>
          <p style="margin:0 0 20px;font-size:15px;color:#4a5568;line-height:1.7;">The agenda for the following meeting has been published and is now available for review:</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7fafc;border-left:4px solid ${PORTAL_GREEN};border-radius:4px;margin:0 0 28px;">
            <tr><td style="padding:20px 24px;">
              <p style="margin:0 0 8px;font-size:16px;font-weight:600;color:#1a202c;">${meetingTitle}</p>
              <p style="margin:0;font-size:14px;color:#718096;">${formattedDate}</p>
            </td></tr>
          </table>
          <!-- CTA Button -->
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" style="padding:0 0 32px;">
                <a href="${portalUrl}" style="display:inline-block;padding:14px 32px;background-color:${PORTAL_GREEN};color:#ffffff;text-decoration:none;border-radius:6px;font-size:15px;font-weight:600;letter-spacing:0.3px;">View Agenda &rarr;</a>
              </td>
            </tr>
          </table>
          <p style="margin:0 0 8px;font-size:14px;color:#718096;line-height:1.7;">You are receiving this notification because you are a member of the ${orgName} portal. If you have any questions, please contact your portal administrator.</p>
          <p style="margin:24px 0 0;font-size:15px;color:#2d3748;">Yours in public service,<br/><strong>The GovClerk Portal Team</strong></p>
        </td>
      </tr>
      <!-- Footer -->
      <tr>
        <td style="background-color:#f8f9fb;padding:20px 40px;border-top:1px solid #e8ecf0;text-align:center;">
          <p style="margin:0;font-size:12px;color:#8a94a6;">GovClerk Portal &middot; Powered by GovClerk Minutes &middot; <a href="https://govclerkminutes.com" style="color:${PORTAL_GREEN};text-decoration:none;">govclerkminutes.com</a></p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  const textBody = `Hello,

The agenda for the following meeting has been published and is now available for review:

Meeting: ${meetingTitle}
Date: ${formattedDate}

View the agenda here: ${portalUrl}

You are receiving this notification because you are a member of the ${orgName} portal.

Yours in public service,
The GovClerk Portal Team

GovClerk Portal · Powered by GovClerk Minutes · govclerkminutes.com`;

  await sendEmail({
    From: FROM_PORTAL,
    To: email,
    Subject: `Agenda Published: ${meetingTitle}`,
    HtmlBody: htmlBody,
    TextBody: textBody,
    MessageStream: "transactional",
  });
}

/**
 * Send a branded GovClerk Portal notification when meeting minutes are published/finalized.
 *
 * @param email        Recipient email address
 * @param orgName      Organisation name
 * @param meetingTitle Title of the meeting
 * @param meetingDate  ISO date string of the meeting
 * @param portalUrl    Public portal URL for the meeting page
 */
export async function sendMinutesPublishedEmail(
  email: string,
  orgName: string,
  meetingTitle: string,
  meetingDate: string,
  portalUrl: string
): Promise<void> {
  const formattedDate = new Date(meetingDate).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const htmlBody = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9;padding:40px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
      <!-- Header -->
      <tr>
        <td style="background-color:${PORTAL_GREEN};padding:28px 40px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:600;letter-spacing:0.5px;">GovClerk Portal</h1>
          <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">${orgName}</p>
        </td>
      </tr>
      <!-- Body -->
      <tr>
        <td style="padding:40px 40px 32px;">
          <p style="margin:0 0 16px;font-size:16px;color:#2d3748;">Hello,</p>
          <p style="margin:0 0 20px;font-size:15px;color:#4a5568;line-height:1.7;">The minutes for the following meeting have been finalised and are now available on the portal:</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7fafc;border-left:4px solid ${PORTAL_GREEN};border-radius:4px;margin:0 0 28px;">
            <tr><td style="padding:20px 24px;">
              <p style="margin:0 0 8px;font-size:16px;font-weight:600;color:#1a202c;">${meetingTitle}</p>
              <p style="margin:0;font-size:14px;color:#718096;">${formattedDate}</p>
            </td></tr>
          </table>
          <!-- CTA Button -->
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" style="padding:0 0 32px;">
                <a href="${portalUrl}" style="display:inline-block;padding:14px 32px;background-color:${PORTAL_GREEN};color:#ffffff;text-decoration:none;border-radius:6px;font-size:15px;font-weight:600;letter-spacing:0.3px;">View Minutes &rarr;</a>
              </td>
            </tr>
          </table>
          <p style="margin:0 0 8px;font-size:14px;color:#718096;line-height:1.7;">You are receiving this notification because you are a member of the ${orgName} portal. If you have any questions, please contact your portal administrator.</p>
          <p style="margin:24px 0 0;font-size:15px;color:#2d3748;">Yours in public service,<br/><strong>The GovClerk Portal Team</strong></p>
        </td>
      </tr>
      <!-- Footer -->
      <tr>
        <td style="background-color:#f8f9fb;padding:20px 40px;border-top:1px solid #e8ecf0;text-align:center;">
          <p style="margin:0;font-size:12px;color:#8a94a6;">GovClerk Portal &middot; Powered by GovClerk Minutes &middot; <a href="https://govclerkminutes.com" style="color:${PORTAL_GREEN};text-decoration:none;">govclerkminutes.com</a></p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  const textBody = `Hello,

The minutes for the following meeting have been finalised and are now available on the portal:

Meeting: ${meetingTitle}
Date: ${formattedDate}

View the minutes here: ${portalUrl}

You are receiving this notification because you are a member of the ${orgName} portal.

Yours in public service,
The GovClerk Portal Team

GovClerk Portal · Powered by GovClerk Minutes · govclerkminutes.com`;

  await sendEmail({
    From: FROM_PORTAL,
    To: email,
    Subject: `Minutes Published: ${meetingTitle}`,
    HtmlBody: htmlBody,
    TextBody: textBody,
    MessageStream: "transactional",
  });
}

/**
 * Distribute agenda published notifications to all active members of a portal organisation.
 *
 * @param orgId        Organisation ID
 * @param orgName      Organisation name (for email personalisation)
 * @param portalSlug   Public portal slug (e.g. "capetown")
 * @param meetingId    Meeting ID
 * @param meetingTitle Title of the meeting
 * @param meetingDate  ISO date string of the meeting
 */
export async function distributeAgendaToOrgMembers(
  orgId: string,
  orgName: string,
  portalSlug: string,
  meetingId: string | number,
  meetingTitle: string,
  meetingDate: string
): Promise<void> {
  const portalUrl = `https://govclerkminutes.com/portal/${portalSlug}/meetings/${meetingId}`;

  const conn = getPortalDbConnection();
  const usersResult = await conn.execute(
    "SELECT email FROM gc_portal_users WHERE org_id = ? AND is_active = 1",
    [orgId]
  );

  const emails = (usersResult.rows as { email: string }[]).map((r) => r.email);
  if (emails.length === 0) {
    return;
  }

  const results = await Promise.allSettled(
    emails.map((email) =>
      sendAgendaPublishedEmail(email, orgName, meetingTitle, meetingDate, portalUrl)
    )
  );

  const failed = results.filter((r) => r.status === "rejected");
  if (failed.length > 0) {
    console.error(
      `[distributeAgendaToOrgMembers] ${failed.length}/${emails.length} emails failed for org ${orgId}`
    );
  }
}

/**
 * Distribute minutes published notifications to all active members of a portal organisation.
 *
 * @param orgId        Organisation ID
 * @param orgName      Organisation name (for email personalisation)
 * @param portalSlug   Public portal slug (e.g. "capetown")
 * @param meetingId    Meeting ID
 * @param meetingTitle Title of the meeting
 * @param meetingDate  ISO date string of the meeting
 */
export async function distributeMinutesToOrgMembers(
  orgId: string,
  orgName: string,
  portalSlug: string,
  meetingId: string | number,
  meetingTitle: string,
  meetingDate: string
): Promise<void> {
  const portalUrl = `https://govclerkminutes.com/portal/${portalSlug}/meetings/${meetingId}`;

  const conn = getPortalDbConnection();
  const usersResult = await conn.execute(
    "SELECT email FROM gc_portal_users WHERE org_id = ? AND is_active = 1",
    [orgId]
  );

  const emails = (usersResult.rows as { email: string }[]).map((r) => r.email);
  if (emails.length === 0) {
    return;
  }

  const results = await Promise.allSettled(
    emails.map((email) =>
      sendMinutesPublishedEmail(email, orgName, meetingTitle, meetingDate, portalUrl)
    )
  );

  const failed = results.filter((r) => r.status === "rejected");
  if (failed.length > 0) {
    console.error(
      `[distributeMinutesToOrgMembers] ${failed.length}/${emails.length} emails failed for org ${orgId}`
    );
  }
}
