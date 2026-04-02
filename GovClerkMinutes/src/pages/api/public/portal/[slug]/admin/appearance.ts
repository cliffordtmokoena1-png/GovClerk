/**
 * Portal-session-authenticated appearance (portal settings) endpoint.
 *
 * GET /api/public/portal/[slug]/admin/appearance — Returns branding/settings.
 * PUT /api/public/portal/[slug]/admin/appearance — Updates branding/settings.
 *
 * Only portal users with role='admin' may access this endpoint.
 * Uses portal auth (gc_portal_sessions), NOT Clerk auth.
 */

import { NextRequest } from "next/server";
import { getPortalDbConnection } from "@/utils/portalDb";
import { getPortalSession } from "@/portal-auth/portalAuth";
import { jsonResponse, errorResponse } from "@/utils/apiHelpers";

export const config = {
  runtime: "edge",
};

function rowToAppearance(row: any) {
  let navLinks = row.nav_links;
  if (typeof navLinks === "string") {
    try {
      navLinks = JSON.parse(navLinks);
    } catch {
      navLinks = null;
    }
  }

  return {
    id: row.id,
    pageTitle: row.page_title ?? null,
    pageDescription: row.page_description ?? null,
    logoUrl: row.logo_url ?? null,
    headerBgColor: row.header_bg_color ?? "#1e3a5f",
    headerTextColor: row.header_text_color ?? "#ffffff",
    accentColor: row.accent_color ?? "#1e3a5f",
    navLinks: navLinks ?? null,
    isEnabled: Boolean(row.is_enabled),
  };
}

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

  const settingsResult = await conn.execute(
    "SELECT org_id FROM gc_portal_settings WHERE slug = ?",
    [slug]
  );
  if (settingsResult.rows.length === 0) {
    return errorResponse("Portal not found", 404);
  }
  const orgId = (settingsResult.rows[0] as any).org_id;
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
    const result = await conn.execute(
      `SELECT id, page_title, page_description, logo_url, header_bg_color,
              header_text_color, accent_color, nav_links, is_enabled
       FROM gc_portal_settings
       WHERE org_id = ? AND slug = ?
       LIMIT 1`,
      [orgId, slug]
    );
    if (result.rows.length === 0) {
      return errorResponse("Portal settings not found", 404);
    }
    return jsonResponse({ appearance: rowToAppearance(result.rows[0] as any) });
  }

  if (req.method === "PUT") {
    const body = await req.json().catch(() => ({}));
    const {
      pageTitle,
      pageDescription,
      logoUrl,
      headerBgColor,
      headerTextColor,
      accentColor,
      navLinks,
      isEnabled,
    } = body as {
      pageTitle?: string;
      pageDescription?: string;
      logoUrl?: string;
      headerBgColor?: string;
      headerTextColor?: string;
      accentColor?: string;
      navLinks?: Array<{ label: string; url: string }>;
      isEnabled?: boolean;
    };

    const updates: string[] = [];
    const values: any[] = [];

    if (pageTitle !== undefined) {
      updates.push("page_title = ?");
      values.push(pageTitle);
    }
    if (pageDescription !== undefined) {
      updates.push("page_description = ?");
      values.push(pageDescription);
    }
    if (logoUrl !== undefined) {
      updates.push("logo_url = ?");
      values.push(logoUrl);
    }
    if (headerBgColor !== undefined) {
      updates.push("header_bg_color = ?");
      values.push(headerBgColor);
    }
    if (headerTextColor !== undefined) {
      updates.push("header_text_color = ?");
      values.push(headerTextColor);
    }
    if (accentColor !== undefined) {
      updates.push("accent_color = ?");
      values.push(accentColor);
    }
    if (navLinks !== undefined) {
      updates.push("nav_links = ?");
      values.push(JSON.stringify(navLinks));
    }
    if (isEnabled !== undefined) {
      updates.push("is_enabled = ?");
      values.push(isEnabled ? 1 : 0);
    }

    if (updates.length === 0) {
      return errorResponse("No fields to update", 400);
    }

    values.push(orgId, slug);

    await conn.execute(
      `UPDATE gc_portal_settings SET ${updates.join(", ")} WHERE org_id = ? AND slug = ?`,
      values
    );

    const result = await conn.execute(
      `SELECT id, page_title, page_description, logo_url, header_bg_color,
              header_text_color, accent_color, nav_links, is_enabled
       FROM gc_portal_settings
       WHERE org_id = ? AND slug = ?
       LIMIT 1`,
      [orgId, slug]
    );

    if (result.rows.length === 0) {
      return errorResponse("Portal settings not found after update", 404);
    }

    return jsonResponse({ appearance: rowToAppearance(result.rows[0] as any) });
  }

  return errorResponse("Method not allowed", 405);
}
