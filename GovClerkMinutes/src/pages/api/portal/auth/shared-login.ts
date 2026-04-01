/**
 * POST /api/portal/auth/shared-login
 * Shared organisation password login.
 *
 * Body: { slug: string; password: string }
 *
 * 1. Look up gc_portal_settings by slug to get org_id
 * 2. Look up gc_portal_shared_passwords for org where is_active=1 and not expired
 * 3. Try verifyPassword against each active shared password
 * 4. On match: create session with auth_type='shared', sharedPasswordId set
 * 5. Return { success: true, authType: "shared" }
 */

import { NextRequest } from "next/server";
import { getPortalDbConnection } from "@/utils/portalDb";
import { errorResponse } from "@/utils/apiHelpers";
import { verifyPassword, createPortalSession } from "@/portal-auth/portalAuth";
import type { PortalLoginResponse } from "@/types/portal";

export const config = {
  runtime: "edge",
};

export default async function handler(req: NextRequest): Promise<Response> {
  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  let body: { slug?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid request body", 400);
  }

  const { slug, password } = body;
  if (!slug || !password) {
    return errorResponse("slug and password are required", 400);
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

  // 2. Fetch all active shared passwords for this org
  const sharedResult = await conn.execute(
    `SELECT id, password_hash FROM gc_portal_shared_passwords
     WHERE org_id = ? AND is_active = 1 AND (expires_at IS NULL OR expires_at > UTC_TIMESTAMP())`,
    [orgId]
  );

  if (sharedResult.rows.length === 0) {
    return errorResponse("Invalid password", 401);
  }

  // 3. Try each shared password
  let matchedId: number | null = null;
  for (const row of sharedResult.rows as any[]) {
    const valid = await verifyPassword(password, row.password_hash);
    if (valid) {
      matchedId = row.id;
      break;
    }
  }

  if (matchedId === null) {
    return errorResponse("Invalid password", 401);
  }

  // 4. Create session
  const { cookieValue } = await createPortalSession({
    orgId,
    sharedPasswordId: matchedId,
    authType: "shared",
  });

  const response: PortalLoginResponse = {
    success: true,
    authType: "shared",
  };

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": cookieValue,
    },
  });
}
