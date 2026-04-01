/**
 * GET /api/public/portal/[slug]/auth-info
 * Returns public auth configuration for a portal:
 * - allowedDomains: email domains permitted for registration
 * - hasSharedPassword: whether any active shared passwords exist
 *
 * Does NOT expose password hashes.
 */

import { NextRequest } from "next/server";
import { getPortalDbConnection } from "@/utils/portalDb";
import { errorResponse, jsonResponse } from "@/utils/apiHelpers";

export const config = {
  runtime: "edge",
};

export default async function handler(req: NextRequest): Promise<Response> {
  if (req.method !== "GET") {
    return errorResponse("Method not allowed", 405);
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/");
  // Path: /api/public/portal/[slug]/auth-info
  // Find slug by looking for "auth-info" and taking the segment before it
  const authInfoIndex = pathParts.indexOf("auth-info");
  const slug = authInfoIndex > 0 ? pathParts[authInfoIndex - 1] : null;

  if (!slug) {
    return errorResponse("Portal slug is required", 400);
  }

  const conn = getPortalDbConnection();

  // Look up portal settings by slug
  const settingsResult = await conn.execute(
    "SELECT org_id FROM gc_portal_settings WHERE slug = ? AND is_enabled = 1",
    [slug]
  );
  if (settingsResult.rows.length === 0) {
    return errorResponse("Portal not found", 404);
  }
  const orgId = (settingsResult.rows[0] as any).org_id as string;

  // Fetch allowed domains
  const domainsResult = await conn.execute(
    "SELECT domain FROM gc_portal_org_domains WHERE org_id = ? AND is_active = 1",
    [orgId]
  );
  const allowedDomains = (domainsResult.rows as any[]).map((r) => r.domain as string);

  // Check if any active shared passwords exist
  const sharedResult = await conn.execute(
    `SELECT COUNT(*) as cnt FROM gc_portal_shared_passwords
     WHERE org_id = ? AND is_active = 1 AND (expires_at IS NULL OR expires_at > UTC_TIMESTAMP())`,
    [orgId]
  );
  const hasSharedPassword = Number((sharedResult.rows[0] as any).cnt) > 0;

  return jsonResponse({ allowedDomains, hasSharedPassword });
}
