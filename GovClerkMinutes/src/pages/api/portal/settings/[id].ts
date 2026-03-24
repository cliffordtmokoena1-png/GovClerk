import withErrorReporting from "@/error/withErrorReporting";
import { getAuth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { resolveRequestContext } from "@/utils/resolveRequestContext";
import { errorResponse, jsonResponse } from "@/utils/apiHelpers";
import { getPortalDbConnection } from "@/utils/portalDb";
import type {
  PortalSettings,
  UpdatePortalSettingsRequest,
  PortalSettingsResponse,
} from "@/types/portal";

export const config = {
  runtime: "edge",
};

function rowToPortalSettings(row: any): PortalSettings {
  // nav_links may already be parsed by PlanetScale driver or still be a string
  let navLinks = row.nav_links;
  if (typeof navLinks === "string") {
    navLinks = JSON.parse(navLinks);
  }

  return {
    id: row.id,
    orgId: row.org_id,
    slug: row.slug,
    pageTitle: row.page_title,
    pageDescription: row.page_description,
    logoUrl: row.logo_url,
    headerBgColor: row.header_bg_color,
    headerTextColor: row.header_text_color,
    accentColor: row.accent_color,
    navLinks: navLinks || null,
    isEnabled: Boolean(row.is_enabled),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function handlePut(
  id: string,
  orgId: string,
  body: UpdatePortalSettingsRequest
): Promise<Response> {
  const conn = getPortalDbConnection();

  // Verify settings belong to org
  const existing = await conn.execute(
    "SELECT * FROM gc_portal_settings WHERE id = ? AND org_id = ?",
    [id, orgId]
  );

  if (existing.rows.length === 0) {
    return errorResponse("Portal settings not found", 404);
  }

  const updates: string[] = [];
  const values: any[] = [];

  if (body.pageTitle !== undefined) {
    updates.push("page_title = ?");
    values.push(body.pageTitle);
  }
  if (body.pageDescription !== undefined) {
    updates.push("page_description = ?");
    values.push(body.pageDescription);
  }
  if (body.logoUrl !== undefined) {
    updates.push("logo_url = ?");
    values.push(body.logoUrl);
  }
  if (body.headerBgColor !== undefined) {
    updates.push("header_bg_color = ?");
    values.push(body.headerBgColor);
  }
  if (body.headerTextColor !== undefined) {
    updates.push("header_text_color = ?");
    values.push(body.headerTextColor);
  }
  if (body.accentColor !== undefined) {
    updates.push("accent_color = ?");
    values.push(body.accentColor);
  }
  if (body.navLinks !== undefined) {
    updates.push("nav_links = ?");
    values.push(JSON.stringify(body.navLinks));
  }
  if (body.isEnabled !== undefined) {
    updates.push("is_enabled = ?");
    values.push(body.isEnabled);
  }

  if (updates.length === 0) {
    return errorResponse("No fields to update", 400);
  }

  values.push(id, orgId);

  const result = await conn.transaction(async (tx) => {
    await tx.execute(
      `UPDATE gc_portal_settings SET ${updates.join(", ")} WHERE id = ? AND org_id = ?`,
      values
    );

    return tx.execute("SELECT * FROM gc_portal_settings WHERE id = ?", [id]);
  });

  const response: PortalSettingsResponse = {
    settings: rowToPortalSettings(result.rows[0]),
  };

  return jsonResponse(response);
}

async function handleDelete(id: string, orgId: string): Promise<Response> {
  const conn = getPortalDbConnection();

  const existing = await conn.execute(
    "SELECT id FROM gc_portal_settings WHERE id = ? AND org_id = ?",
    [id, orgId]
  );

  if (existing.rows.length === 0) {
    return errorResponse("Portal settings not found", 404);
  }

  await conn.execute("DELETE FROM gc_portal_settings WHERE id = ? AND org_id = ?", [id, orgId]);

  return jsonResponse({ success: true });
}

async function handler(req: NextRequest): Promise<Response> {
  const auth = getAuth(req);
  if (!auth.userId) {
    return errorResponse("Unauthorized", 401);
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/");
  const id = pathParts[pathParts.length - 1];

  if (!id) {
    return errorResponse("Settings ID is required", 400);
  }

  const body = await req.json().catch(() => ({}));
  const { orgId } = await resolveRequestContext(auth.userId, body.orgId, req.headers);

  if (!orgId) {
    return errorResponse("Organization context required", 400);
  }

  if (req.method === "PUT") {
    return handlePut(id, orgId, body);
  }

  if (req.method === "DELETE") {
    return handleDelete(id, orgId);
  }

  return errorResponse("Method not allowed", 405);
}

export default withErrorReporting(handler);
