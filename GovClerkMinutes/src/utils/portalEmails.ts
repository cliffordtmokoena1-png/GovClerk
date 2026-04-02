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
    MessageStream: "signup_and_purchase",
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
    MessageStream: "signup_and_purchase",
  });
}
