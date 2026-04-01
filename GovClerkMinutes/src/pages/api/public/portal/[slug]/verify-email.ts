/**
 * POST /api/public/portal/[slug]/verify-email
 * Sends a 6-digit verification code to the user's organisational email.
 * The user must be authenticated (have a valid portal session).
 *
 * PUT /api/public/portal/[slug]/verify-email
 * Verifies the 6-digit code submitted by the user.
 * On success, marks the portal user's email as verified.
 */

import { NextRequest } from "next/server";
import { getPortalDbConnection } from "@/utils/portalDb";
import { getPortalSession } from "@/portal-auth/portalAuth";
import { errorResponse, jsonResponse } from "@/utils/apiHelpers";
import { sendEmail } from "@/utils/postmark";

export const config = {
  runtime: "edge",
};

/** Generate a cryptographically random 6-digit verification code. */
function generateVerificationCode(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const value = ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
  return String(value % 1000000).padStart(6, "0");
}

export default async function handler(req: NextRequest): Promise<Response> {
  const url = new URL(req.url);
  const pathParts = url.pathname.split("/");
  // Path: /api/public/portal/[slug]/verify-email
  const verifyIndex = pathParts.indexOf("verify-email");
  const slug = verifyIndex > 0 ? pathParts[verifyIndex - 1] : null;

  if (!slug) {
    return errorResponse("Portal slug is required", 400);
  }

  const conn = getPortalDbConnection();

  // Look up portal by slug
  const settingsResult = await conn.execute(
    "SELECT org_id FROM gc_portal_settings WHERE slug = ? AND is_enabled = 1",
    [slug]
  );
  if (settingsResult.rows.length === 0) {
    return errorResponse("Portal not found", 404);
  }
  const orgId = (settingsResult.rows[0] as any).org_id as string;

  // Require a valid portal session
  const session = await getPortalSession(req);
  if (!session) {
    return errorResponse("Unauthorised — please sign in to the portal", 401);
  }

  const email = session.email;
  if (!email) {
    return errorResponse("No email address associated with this session", 400);
  }

  // POST — send verification code
  if (req.method === "POST") {
    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    const expiresAtStr = expiresAt.toISOString().slice(0, 19).replace("T", " ");

    // Invalidate any existing codes for this org+email before inserting a new one
    await conn.execute(
      "DELETE FROM gc_portal_email_verifications WHERE org_id = ? AND email = ?",
      [orgId, email]
    );

    await conn.execute(
      `INSERT INTO gc_portal_email_verifications
         (org_id, email, verification_code, is_verified, expires_at)
       VALUES (?, ?, ?, 0, ?)`,
      [orgId, email, code, expiresAtStr]
    );

    // Send the code via Postmark
    await sendEmail({
      From: '"GovClerk Portal" <admin@govclerkminutes.com>',
      To: email,
      Subject: "Your verification code",
      HtmlBody: `
        <p>Hello,</p>
        <p>Your verification code for the portal is:</p>
        <h2 style="letter-spacing:0.3em;font-size:2rem;">${code}</h2>
        <p>This code expires in 15 minutes.</p>
        <p>If you did not request this, you can safely ignore this email.</p>
      `,
      TextBody: `Your verification code is: ${code}\n\nThis code expires in 15 minutes.`,
      MessageStream: "signup_and_purchase",
    });

    return jsonResponse({ sent: true });
  }

  // PUT — verify submitted code
  if (req.method === "PUT") {
    let body: { code?: string };
    try {
      body = await req.json();
    } catch {
      return errorResponse("Invalid JSON body", 400);
    }

    const submittedCode = (body.code ?? "").trim();
    if (!submittedCode) {
      return errorResponse("Verification code is required", 400);
    }

    // Look up the most recent unexpired code for this org+email
    const verResult = await conn.execute(
      `SELECT id, verification_code, is_verified
       FROM gc_portal_email_verifications
       WHERE org_id = ? AND email = ? AND expires_at > UTC_TIMESTAMP()
       ORDER BY created_at DESC
       LIMIT 1`,
      [orgId, email]
    );

    if (verResult.rows.length === 0) {
      return errorResponse("Verification code has expired. Please request a new one.", 400);
    }

    const row = verResult.rows[0] as any;
    if (row.verification_code !== submittedCode) {
      return errorResponse("Invalid verification code.", 400);
    }

    // Mark as verified
    await conn.execute(
      "UPDATE gc_portal_email_verifications SET is_verified = 1 WHERE id = ?",
      [row.id]
    );

    // Update the portal user's record to mark email as verified (if applicable)
    if (session.portalUserId != null) {
      await conn.execute(
        "UPDATE gc_portal_users SET is_active = 1 WHERE id = ? AND org_id = ?",
        [session.portalUserId, orgId]
      );
    }

    return jsonResponse({ verified: true });
  }

  return errorResponse("Method not allowed", 405);
}
