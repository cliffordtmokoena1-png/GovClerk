/**
 * POST /api/portal/auth/login
 * Email + password login for portal users.
 *
 * Body: { slug: string; email: string; password: string }
 *
 * 1. Look up gc_portal_settings by slug to get org_id
 * 2. Validate email domain via gc_portal_org_domains
 * 3. Look up gc_portal_users by (org_id, email)
 * 4. Verify password hash
 * 5. Create session → set cookie
 * 6. Return { success: true, authType: "email", email, role }
 */

import { NextRequest } from "next/server";
import { getPortalDbConnection } from "@/utils/portalDb";
import { errorResponse, jsonResponse } from "@/utils/apiHelpers";
import {
  verifyPassword,
  createPortalSession,
  isEmailDomainAllowed,
} from "@/portal-auth/portalAuth";
import type { PortalLoginResponse } from "@/types/portal";

export const config = {
  runtime: "edge",
};

export default async function handler(req: NextRequest): Promise<Response> {
  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  let body: { slug?: string; email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid request body", 400);
  }

  const { slug, email, password } = body;
  if (!slug || !email || !password) {
    return errorResponse("slug, email, and password are required", 400);
  }

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

  // 2. Validate email domain
  const domainAllowed = await isEmailDomainAllowed(orgId, email);
  if (!domainAllowed) {
    return errorResponse("Your email domain is not authorised for this portal", 403);
  }

  // 3. Look up user
  const userResult = await conn.execute(
    "SELECT id, password_hash, role, is_active FROM gc_portal_users WHERE org_id = ? AND email = ?",
    [orgId, email.toLowerCase()]
  );
  if (userResult.rows.length === 0) {
    return errorResponse("Invalid email or password", 401);
  }

  const user = userResult.rows[0] as any;
  if (!user.is_active) {
    return errorResponse("Your account has been deactivated. Please contact your administrator.", 403);
  }

  // 4. Verify password
  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return errorResponse("Invalid email or password", 401);
  }

  // Update last_login_at
  await conn.execute(
    "UPDATE gc_portal_users SET last_login_at = UTC_TIMESTAMP() WHERE id = ?",
    [user.id]
  );

  // 5. Create session
  const { cookieValue } = await createPortalSession({
    orgId,
    portalUserId: user.id,
    email: email.toLowerCase(),
    authType: "email",
  });

  const response: PortalLoginResponse = {
    success: true,
    authType: "email",
    email: email.toLowerCase(),
    role: user.role,
  };

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": cookieValue,
    },
  });
}
