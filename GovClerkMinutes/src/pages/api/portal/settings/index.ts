import withErrorReporting from "@/error/withErrorReporting";
import { getAuth } from "@clerk/nextjs/server";
import { createClerkClient } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { resolveRequestContext } from "@/utils/resolveRequestContext";
import { getClerkKeys } from "@/utils/clerk";

import { errorResponse, jsonResponse } from "@/utils/apiHelpers";
import { getPortalDbConnection } from "@/utils/portalDb";
import type {
  CreatePortalSettingsRequest,
  PortalSettingsListResponse,
  PortalSettingsResponse,
} from "@/types/portal";
import {
  getOrCreatePortalSettings,
  rowToPortalSettings,
  PortalSettingsRow,
} from "../utils/initializePortalSettings";

export const config = {
  runtime: "edge",
};

async function handleGet(orgId: string, orgSlug: string): Promise<Response> {
  const conn = getPortalDbConnection();
  const settings = await getOrCreatePortalSettings(conn, orgId, orgSlug);

  const response: PortalSettingsListResponse = {
    settings,
  };

  return jsonResponse(response);
}

async function handlePost(
  orgId: string,
  orgSlug: string,
  body: CreatePortalSettingsRequest
): Promise<Response> {
  const conn = getPortalDbConnection();

  // Check if settings already exist for this org
  const existing = await conn.execute("SELECT id FROM gc_portal_settings WHERE org_id = ?", [
    orgId,
  ]);

  if (existing.rows.length > 0) {
    return errorResponse("Portal settings already exist for this organization", 409);
  }

  const slug = orgSlug;

  // Validate slug uniqueness
  const slugExists = await conn.execute("SELECT id FROM gc_portal_settings WHERE slug = ?", [slug]);

  if (slugExists.rows.length > 0) {
    return errorResponse("Slug is already in use", 409);
  }

  const navLinksJson = body.navLinks ? JSON.stringify(body.navLinks) : null;

  const result = await conn.transaction(async (tx) => {
    const insertResult = await tx.execute(
      `INSERT INTO gc_portal_settings (
        org_id, slug, page_title, page_description, logo_url,
        header_bg_color, header_text_color, accent_color, nav_links, is_enabled
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orgId,
        slug,
        body.pageTitle || null,
        body.pageDescription || null,
        body.logoUrl || null,
        body.headerBgColor || "#1a365d",
        body.headerTextColor || "#ffffff",
        body.accentColor || "#3182ce",
        navLinksJson,
        body.isEnabled !== false,
      ]
    );

    // PlanetScale returns insertId as string
    const id = Number(insertResult.insertId);
    return tx.execute("SELECT * FROM gc_portal_settings WHERE id = ?", [id]);
  });

  const response: PortalSettingsResponse = {
    settings: rowToPortalSettings(result.rows[0] as PortalSettingsRow),
  };

  return jsonResponse(response, 201);
}

async function handler(req: NextRequest): Promise<Response> {
  const auth = getAuth(req);
  if (!auth.userId) {
    return errorResponse("Unauthorized", 401);
  }

  // For GET requests, read orgId from query params
  if (req.method === "GET") {
    const url = new URL(req.url);
    const queryOrgId = url.searchParams.get("orgId");
    const { orgId, site } = await resolveRequestContext(auth.userId, queryOrgId, req.headers);
    if (!orgId) {
      return errorResponse("Organization context required", 400);
    }

    const clerk = createClerkClient(getClerkKeys(site));
    const organization = await clerk.organizations.getOrganization({ organizationId: orgId });

    if (!organization.slug) {
      return errorResponse("Organization does not have a slug configured", 400);
    }

    return handleGet(orgId, organization.slug);
  }

  // For POST/PUT/DELETE, parse body and resolve org context
  const body = await req.json().catch(() => ({}));
  const { orgId, site } = await resolveRequestContext(auth.userId, body.orgId, req.headers);

  if (!orgId) {
    return errorResponse("Organization context required", 400);
  }

  if (req.method === "POST") {
    const clerk = createClerkClient(getClerkKeys(site));
    const organization = await clerk.organizations.getOrganization({ organizationId: orgId });

    if (!organization.slug) {
      return errorResponse("Organization does not have a slug configured", 400);
    }

    return handlePost(orgId, organization.slug, body);
  }

  return errorResponse("Method not allowed", 405);
}

export default withErrorReporting(handler);
