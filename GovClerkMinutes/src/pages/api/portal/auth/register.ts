/**
 * POST /api/portal/auth/register
 * Register a new portal user.
 *
 * Body: { slug: string; email: string; password: string; firstName?: string; lastName?: string }
 *
 * 1. Look up org by slug
 * 2. Validate email is organisational (not a free/personal provider) using freeEmailProviders blocklist
 * 3. Hash password
 * 4. Insert into gc_portal_users with role='member'
 * 5. Return { success: true }
 *
 * Note: role='admin' can only be set by an existing admin via a separate endpoint.
 */

import { NextRequest } from "next/server";
import { getPortalDbConnection } from "@/utils/portalDb";
import { errorResponse, jsonResponse } from "@/utils/apiHelpers";
import { hashPassword, createPortalSession } from "@/portal-auth/portalAuth";
import { isOrganizationalEmail } from "@/utils/freeEmailProviders";

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
    return errorResponse("Portal not found", 404);
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

  // 4. Insert user with role='member'
  const insertResult = await conn.execute(
    `INSERT INTO gc_portal_users
       (org_id, email, password_hash, first_name, last_name, role, email_domain, is_active)
     VALUES (?, ?, ?, ?, ?, 'member', ?, 1)`,
    [orgId, normalizedEmail, passwordHash, firstName ?? null, lastName ?? null, domain]
  );

  const newUserId = (insertResult as any).insertId as number;

  // Auto-login after registration
  const { cookieValue } = await createPortalSession({
    orgId,
    portalUserId: newUserId,
    email: normalizedEmail,
    authType: "email",
  });

  return new Response(JSON.stringify({ success: true }), {
    status: 201,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": cookieValue,
    },
  });
}
