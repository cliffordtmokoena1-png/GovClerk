/**
 * POST /api/portal/auth/forgot-password
 * Initiate a password reset for a portal user.
 *
 * Body: { slug: string; email: string }
 *
 * 1. Look up org by slug (requires is_enabled = 1)
 * 2. Look up portal user by org_id + email
 * 3. If user exists and is active (verified), generate a reset token and send email
 * 4. Always return { success: true } to prevent email enumeration
 */

import { NextRequest } from "next/server";
import { getPortalDbConnection } from "@/utils/portalDb";
import { errorResponse, jsonResponse } from "@/utils/apiHelpers";
import { generateSessionId } from "@/portal-auth/portalAuth";
import { sendPortalPasswordResetEmail } from "@/utils/portalEmails";

export const config = {
  runtime: "edge",
};

export default async function handler(req: NextRequest): Promise<Response> {
  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  let body: { slug?: string; email?: string };
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid request body", 400);
  }

  const { slug, email } = body;
  if (!slug || !email) {
    return errorResponse("slug and email are required", 400);
  }

  const normalizedEmail = email.toLowerCase().trim();

  const conn = getPortalDbConnection();

  // 1. Look up portal settings by slug
  const settingsResult = await conn.execute(
    "SELECT org_id, page_title FROM gc_portal_settings WHERE slug = ? AND is_enabled = 1",
    [slug]
  );
  if (settingsResult.rows.length === 0) {
    // Return success regardless to prevent enumeration
    return jsonResponse({ success: true });
  }

  const settings = settingsResult.rows[0] as any;
  const orgId = settings.org_id as string;
  const orgName = settings.page_title as string | undefined;

  // 2. Look up portal user
  const userResult = await conn.execute(
    "SELECT id FROM gc_portal_users WHERE org_id = ? AND email = ? AND is_active = 1",
    [orgId, normalizedEmail]
  );

  // Always return success — do NOT reveal whether the user exists
  if (userResult.rows.length === 0) {
    return jsonResponse({ success: true });
  }

  // 3. Generate a secure reset token (32 bytes = 64 hex chars)
  const resetToken = generateSessionId();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  const expiresAtStr = expiresAt.toISOString().slice(0, 19).replace("T", " ");

  // Delete any existing reset tokens for this org+email
  await conn.execute(
    "DELETE FROM gc_portal_email_verifications WHERE org_id = ? AND email = ?",
    [orgId, normalizedEmail]
  );

  // Store the reset token
  await conn.execute(
    `INSERT INTO gc_portal_email_verifications
       (org_id, email, verification_code, is_verified, expires_at)
     VALUES (?, ?, ?, 0, ?)`,
    [orgId, normalizedEmail, resetToken, expiresAtStr]
  );

  // 4. Send password reset email (non-blocking on failure)
  try {
    await sendPortalPasswordResetEmail(normalizedEmail, resetToken, slug, orgName);
  } catch (err) {
    console.error("[forgot-password] Failed to send password reset email:", err);
  }

  return jsonResponse({ success: true });
}
