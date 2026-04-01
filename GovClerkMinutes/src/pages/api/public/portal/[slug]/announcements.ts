/**
 * GET /api/public/portal/[slug]/announcements
 * Returns active portal announcements for the org.
 * No auth required.
 */
import { NextRequest } from "next/server";
import { getPortalDbConnection } from "@/utils/portalDb";
import { errorResponse, jsonResponse } from "@/utils/apiHelpers";
import type { PortalAnnouncement } from "@/types/publicRecords";

export const config = {
  runtime: "edge",
};

export default async function handler(req: NextRequest): Promise<Response> {
  if (req.method !== "GET") {
    return errorResponse("Method not allowed", 405);
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/");
  const slugIndex = pathParts.indexOf("portal") + 1;
  const slug = pathParts[slugIndex];

  if (!slug) {
    return errorResponse("Portal slug is required", 400);
  }

  const conn = getPortalDbConnection();

  const settingsRes = await conn.execute(
    "SELECT org_id FROM gc_portal_settings WHERE slug = ? AND is_enabled = 1",
    [slug]
  );
  if (settingsRes.rows.length === 0) {
    return errorResponse("Portal not found", 404);
  }
  const orgId = (settingsRes.rows[0] as any).org_id as string;

  const result = await conn.execute(
    `SELECT id, org_id, title, body, type, is_active, published_at, expires_at
     FROM gc_portal_announcements
     WHERE org_id = ? AND is_active = 1
       AND (expires_at IS NULL OR expires_at > UTC_TIMESTAMP())
     ORDER BY published_at DESC`,
    [orgId]
  );

  const announcements: PortalAnnouncement[] = (result.rows as any[]).map((row) => ({
    id: row.id,
    orgId: row.org_id,
    title: row.title,
    body: row.body,
    type: row.type,
    isActive: Boolean(row.is_active),
    publishedAt: row.published_at,
    expiresAt: row.expires_at || null,
  }));

  return jsonResponse({ announcements });
}
