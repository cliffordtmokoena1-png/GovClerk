/**
 * POST /api/portal/auth/register
 * Register a new portal user.
 *
 * Body: { slug: string; email: string; password: string; firstName?: string; lastName?: string }
 *
 * 1. Look up org by slug
 * 2. Validate email is organisational (not a free/personal provider) using freeEmailProviders blocklist
 * 3. Hash password
 * 4. Insert into gc_portal_users with role='member' and is_active=0 (pending verification)
 * 5. Generate 6-digit verification code and store in gc_portal_email_verifications
 * 6. Send verification email via GovClerk Portal branded template
 * 7. Auto-login (create session) and return { success: true, requiresVerification: true }
 *
 * Note: role='admin' can only be set by an existing admin via a separate endpoint.
 */

import { NextRequest } from "next/server";
import { getPortalDbConnection } from "@/utils/portalDb";
import { errorResponse } from "@/utils/apiHelpers";
import { hashPassword, createPortalSession } from "@/portal-auth/portalAuth";
import { isOrganizationalEmail } from "@/utils/freeEmailProviders";
import { sendPortalVerificationEmail } from "@/utils/portalEmails";

/** Generate a cryptographically random 6-digit verification code with no modulo bias. */
function generateVerificationCode(): string {
  while (true) {
    const bytes = new Uint8Array(3); // 3 bytes = up to 16777215
    crypto.getRandomValues(bytes);
    const value = (bytes[0] << 16) | (bytes[1] << 8) | bytes[2];
    if (value < 1000000) {
      return String(value).padStart(6, "0");
    }
  }
}

export const config = {
  runtime: "edge",
};

export default async function handler(req: NextRequest): Promise<Response> {
  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  let body: {
    slug?: string;
    email?: string;
    password?: string;
    firstName?: string;
    lastName?: string;
  };
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid request body", 400);
  }

  const { slug, email, password, firstName, lastName } = body;
  if (!slug || !email || !password) {
    return errorResponse("slug, email, and password are required", 400);
  }

  if (password.length < 8) {
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
    return errorResponse(
      "This organisation hasn't been set up on GovClerk yet. Please contact your administrator or create an organisation first.",
      400
    );
  }
  const orgId = (settingsResult.rows[0] as any).org_id as string;

  // 2. Validate email domain (blocklist approach — reject free/personal providers)
  if (!isOrganizationalEmail(normalizedEmail)) {
    return errorResponse(
      "This portal requires an organisational email address. Personal email addresses (Gmail, Yahoo, Outlook, etc.) are not accepted. If you belong to an organisation, please use your work email.",
      403
    );
  }

  // Check if user already exists
  const existingUser = await conn.execute(
    "SELECT id FROM gc_portal_users WHERE org_id = ? AND email = ?",
    [orgId, normalizedEmail]
  );
  if (existingUser.rows.length > 0) {
    return errorResponse("An account with this email already exists", 409);
  }

  // 3. Hash password
  const passwordHash = await hashPassword(password);
  const domain = normalizedEmail.split("@")[1] ?? "";

  // 4. Insert user with role='member' and is_active=0 (pending email verification)
  const insertResult = await conn.execute(
    `INSERT INTO gc_portal_users
       (org_id, email, password_hash, first_name, last_name, role, email_domain, is_active)
     VALUES (?, ?, ?, ?, ?, 'member', ?, 0)`,
    [orgId, normalizedEmail, passwordHash, firstName ?? null, lastName ?? null, domain]
  );

  const newUserId = (insertResult as any).insertId as number;

  // 5. Generate a 6-digit verification code and store it (15-minute expiry)
  const code = generateVerificationCode();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  const expiresAtStr = expiresAt.toISOString().slice(0, 19).replace("T", " ");

  // Invalidate any pre-existing codes for this org+email
  await conn.execute(
    "DELETE FROM gc_portal_email_verifications WHERE org_id = ? AND email = ?",
    [orgId, normalizedEmail]
  );

  await conn.execute(
    `INSERT INTO gc_portal_email_verifications
       (org_id, email, verification_code, is_verified, expires_at)
     VALUES (?, ?, ?, 0, ?)`,
    [orgId, normalizedEmail, code, expiresAtStr]
  );

  // 6. Fetch org name for the email (best-effort — fall back gracefully)
  let orgName: string | undefined;
  try {
    const orgResult = await conn.execute(
      "SELECT page_title FROM gc_portal_settings WHERE org_id = ? LIMIT 1",
      [orgId]
    );
    if (orgResult.rows.length > 0) {
      orgName = (orgResult.rows[0] as any).page_title as string | undefined;
    }
  } catch {
    // Non-critical — proceed without org name
  }

  // 7. Send branded GovClerk Portal verification email (non-blocking on failure)
  try {
    await sendPortalVerificationEmail(normalizedEmail, code, orgName);
  } catch (err) {
    console.error("[register] Failed to send portal verification email:", err);
    // Do not abort registration — the user can request a new code from the verify page
  }

  // Auto-login so the user can access the verification page immediately
  const { cookieValue } = await createPortalSession({
    orgId,
    portalUserId: newUserId,
    email: normalizedEmail,
    authType: "email",
  });

  return new Response(JSON.stringify({ success: true, requiresVerification: true }), {
    status: 201,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": cookieValue,
    },
  });
}
