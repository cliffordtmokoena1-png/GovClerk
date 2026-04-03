/**
 * Portal-session-authenticated settings endpoint.
 *
 * GET /api/public/portal/[slug]/admin/settings — Returns org domains, shared passwords, visibility.
 * PUT /api/public/portal/[slug]/admin/settings — Updates domains, visibility.
 *
 * Only portal users with role='admin' may access this endpoint.
 * Uses portal auth (gc_portal_sessions), NOT Clerk auth.
 */

import { NextRequest } from "next/server";
import { getPortalDbConnection } from "@/utils/portalDb";
import { getPortalSession, isGovClerkAdmin } from "@/portal-auth/portalAuth";
import { jsonResponse, errorResponse } from "@/utils/apiHelpers";

export const config = {
  runtime: "edge",
};

async function resolveAdminOrgId(
  req: NextRequest
): Promise<{ orgId: string; slug: string } | Response> {
  const session = await getPortalSession(req);
  if (!session) {
    return errorResponse("Unauthorized", 401);
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/");
  const portalIndex = pathParts.indexOf("portal");
  const slug = portalIndex >= 0 ? pathParts[portalIndex + 1] : null;

  if (!slug) {
    return errorResponse("Portal slug is required", 400);
  }

  const conn = getPortalDbConnection();

  // Note: settings endpoint does not require is_enabled=1 so admins can still
  // access settings even when the portal is disabled.
  const settingsResult = await conn.execute(
    "SELECT org_id FROM gc_portal_settings WHERE slug = ?",
    [slug]
  );
  if (settingsResult.rows.length === 0) {
    return errorResponse("Portal not found", 404);
  }
  const orgId = (settingsResult.rows[0] as any).org_id;

  // GovClerk admins bypass all org and role checks
  if (isGovClerkAdmin(session.email)) {
    return { orgId, slug };
  }

  if (orgId !== session.orgId) {
    return errorResponse("Forbidden", 403);
  }

  if (!session.portalUserId) {
    return errorResponse("Admin access required", 403);
  }
  const userResult = await conn.execute(
    "SELECT role FROM gc_portal_users WHERE id = ? AND org_id = ?",
    [session.portalUserId, orgId]
  );
  if (userResult.rows.length === 0) {
    return errorResponse("User not found", 404);
  }
  if ((userResult.rows[0] as any).role !== "admin") {
    return errorResponse("Admin role required", 403);
  }

  return { orgId, slug };
}

export default async function handler(req: NextRequest): Promise<Response> {
  const resolved = await resolveAdminOrgId(req);
  if (resolved instanceof Response) {return resolved;}
  const { orgId, slug } = resolved;

  const conn = getPortalDbConnection();

  if (req.method === "GET") {
    const [domainsResult, passwordsResult, visibilityResult] = await Promise.all([
      conn.execute(
        "SELECT id, domain, is_active FROM gc_portal_org_domains WHERE org_id = ? ORDER BY created_at ASC",
        [orgId]
      ),
      conn.execute(
        "SELECT id, label, expires_at, is_active, created_at FROM gc_portal_shared_passwords WHERE org_id = ? ORDER BY created_at DESC",
        [orgId]
      ),
      conn.execute("SELECT is_enabled FROM gc_portal_settings WHERE org_id = ? AND slug = ? LIMIT 1", [
        orgId,
        slug,
      ]),
    ]);

    const domains = domainsResult.rows.map((row: any) => ({
      id: Number(row.id),
      domain: row.domain,
      isActive: Boolean(row.is_active),
    }));

    const sharedPasswords = passwordsResult.rows.map((row: any) => ({
      id: Number(row.id),
      label: row.label,
      expiresAt: row.expires_at ?? null,
      isActive: Boolean(row.is_active),
      createdAt: row.created_at,
    }));

    const isEnabled =
      visibilityResult.rows.length > 0
        ? Boolean((visibilityResult.rows[0] as any).is_enabled)
        : true;

    return jsonResponse({ domains, sharedPasswords, isEnabled });
  }

  if (req.method === "PUT") {
    const body = await req.json().catch(() => ({}));
    const { isEnabled, addDomain, removeDomainId } = body as {
      isEnabled?: boolean;
      addDomain?: string;
      removeDomainId?: number;
    };

    if (isEnabled !== undefined) {
      await conn.execute(
        "UPDATE gc_portal_settings SET is_enabled = ? WHERE org_id = ? AND slug = ?",
        [isEnabled ? 1 : 0, orgId, slug]
      );
    }

    if (addDomain) {
      const domain = addDomain.trim().toLowerCase();
      if (!/^[a-z0-9]+([.-][a-z0-9]+)*\.[a-z]{2,}$/i.test(domain)) {
        return errorResponse("Invalid domain format", 400);
      }
      await conn.execute(
        `INSERT INTO gc_portal_org_domains (org_id, domain, is_active)
         VALUES (?, ?, 1)
         ON DUPLICATE KEY UPDATE is_active = 1`,
        [orgId, domain]
      );
    }

    if (removeDomainId) {
      await conn.execute(
        "UPDATE gc_portal_org_domains SET is_active = 0 WHERE id = ? AND org_id = ?",
        [removeDomainId, orgId]
      );
    }

    // Re-fetch and return current state
    const [domainsResult, passwordsResult, visibilityResult] = await Promise.all([
      conn.execute(
        "SELECT id, domain, is_active FROM gc_portal_org_domains WHERE org_id = ? ORDER BY created_at ASC",
        [orgId]
      ),
      conn.execute(
        "SELECT id, label, expires_at, is_active, created_at FROM gc_portal_shared_passwords WHERE org_id = ? ORDER BY created_at DESC",
        [orgId]
      ),
      conn.execute("SELECT is_enabled FROM gc_portal_settings WHERE org_id = ? AND slug = ? LIMIT 1", [
        orgId,
        slug,
      ]),
    ]);

    const domains = domainsResult.rows.map((row: any) => ({
      id: Number(row.id),
      domain: row.domain,
      isActive: Boolean(row.is_active),
    }));

    const sharedPasswords = passwordsResult.rows.map((row: any) => ({
      id: Number(row.id),
      label: row.label,
      expiresAt: row.expires_at ?? null,
      isActive: Boolean(row.is_active),
      createdAt: row.created_at,
    }));

    const isEnabledNow =
      visibilityResult.rows.length > 0
        ? Boolean((visibilityResult.rows[0] as any).is_enabled)
        : true;

    return jsonResponse({ domains, sharedPasswords, isEnabled: isEnabledNow });
  }

  return errorResponse("Method not allowed", 405);
}
