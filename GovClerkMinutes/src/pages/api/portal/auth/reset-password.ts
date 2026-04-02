/**
 * POST /api/portal/auth/reset-password
 * Complete a password reset using a token from the forgot-password flow.
 *
 * Body: { slug: string; email: string; token: string; newPassword: string }
 *
 * 1. Validate inputs
 * 2. Look up org by slug
 * 3. Verify the token in gc_portal_email_verifications (not expired, not yet used)
 * 4. Hash the new password
 * 5. Update gc_portal_users with the new password hash
 * 6. Mark the token as used (is_verified = 1)
 * 7. Return { success: true }
 */

import { NextRequest } from "next/server";
import { getPortalDbConnection } from "@/utils/portalDb";
import { errorResponse, jsonResponse } from "@/utils/apiHelpers";
import { hashPassword } from "@/portal-auth/portalAuth";

export const config = {
  runtime: "edge",
};

export default async function handler(req: NextRequest): Promise<Response> {
  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  let body: { slug?: string; email?: string; token?: string; newPassword?: string };
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid request body", 400);
  }

  const { slug, email, token, newPassword } = body;
  if (!slug || !email || !token || !newPassword) {
    return errorResponse("slug, email, token, and newPassword are required", 400);
  }

  if (newPassword.length < 8) {
    return errorResponse("Password must be at least 8 characters", 400);
  }

  const normalizedEmail = email.toLowerCase().trim();

  const conn = getPortalDbConnection();

  // 1. Look up portal settings by slug
  const settingsResult = await conn.execute(
    "SELECT org_id FROM gc_portal_settings WHERE slug = ? AND is_enabled = 1",
    [slug]
  );
  if (settingsResult.rows.length === 0) {
    return errorResponse("Invalid or expired reset link", 400);
  }
  const orgId = (settingsResult.rows[0] as any).org_id as string;

  // 2. Verify the reset token
  const tokenResult = await conn.execute(
    `SELECT id FROM gc_portal_email_verifications
     WHERE org_id = ? AND email = ? AND verification_code = ? AND is_verified = 0
       AND expires_at > UTC_TIMESTAMP()`,
    [orgId, normalizedEmail, token]
  );
  if (tokenResult.rows.length === 0) {
    return errorResponse("Invalid or expired reset link. Please request a new one.", 400);
  }
  const tokenId = (tokenResult.rows[0] as any).id as number;

  // 3. Hash the new password
  const passwordHash = await hashPassword(newPassword);

  // 4. Update the user's password
  await conn.execute(
    "UPDATE gc_portal_users SET password_hash = ? WHERE org_id = ? AND email = ?",
    [passwordHash, orgId, normalizedEmail]
  );

  // 5. Mark the token as used
  await conn.execute(
    "UPDATE gc_portal_email_verifications SET is_verified = 1 WHERE id = ?",
    [tokenId]
  );

  return jsonResponse({ success: true });
}
