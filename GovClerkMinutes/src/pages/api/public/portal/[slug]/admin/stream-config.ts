/**
 * Portal-session-authenticated stream configuration endpoint.
 *
 * GET /api/public/portal/[slug]/admin/stream-config — Returns current stream config.
 * PUT /api/public/portal/[slug]/admin/stream-config — Updates stream config.
 *
 * Only portal users with role='admin' may access this endpoint.
 * Uses portal auth (gc_portal_sessions), NOT Clerk auth.
 */

import { NextRequest } from "next/server";
import { getPortalDbConnection } from "@/utils/portalDb";
import { getPortalSession, isGovClerkAdmin } from "@/portal-auth/portalAuth";
import { jsonResponse, errorResponse } from "@/utils/apiHelpers";
import type { StreamConfig, StreamPlatform } from "@/types/liveSession";

export const config = {
  runtime: "edge",
};

function rowToStreamConfig(row: any): StreamConfig {
  return {
    id: Number(row.id),
    orgId: row.org_id,
    youtubeLiveUrl: row.youtube_live_url ?? null,
    youtubeChannelId: row.youtube_channel_id ?? null,
    zoomJoinUrl: row.zoom_join_url ?? null,
    zoomWebinarId: row.zoom_webinar_id ?? null,
    googleMeetUrl: row.google_meet_url ?? null,
    facebookLiveUrl: row.facebook_live_url ?? null,
    facebookPageId: row.facebook_page_id ?? null,
    rtmpHlsUrl: row.rtmp_hls_url ?? null,
    customEmbedUrl: row.custom_embed_url ?? null,
    tiktokLiveUrl: row.tiktok_live_url ?? null,
    preferredPlatform: row.preferred_platform ?? "youtube",
    isActive: Boolean(row.is_active),
  };
}

async function resolveAdminOrgId(req: NextRequest): Promise<{ orgId: string } | Response> {
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
    "SELECT org_id FROM gc_portal_settings WHERE slug = ? AND is_enabled = 1",
    [slug]
  );
  if (settingsResult.rows.length === 0) {
    return errorResponse("Portal not found", 404);
  }
  const orgId = (settingsResult.rows[0] as any).org_id;

  // GovClerk admins bypass all org and role checks
  if (isGovClerkAdmin(session.email)) {
    return { orgId };
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

  return { orgId };
}

export default async function handler(req: NextRequest): Promise<Response> {
  const resolved = await resolveAdminOrgId(req);
  if (resolved instanceof Response) {return resolved;}
  const { orgId } = resolved;

  const conn = getPortalDbConnection();

  if (req.method === "GET") {
    const result = await conn.execute(
      "SELECT * FROM gc_portal_stream_config WHERE org_id = ? LIMIT 1",
      [orgId]
    );
    const streamConfig = result.rows.length > 0 ? rowToStreamConfig(result.rows[0] as any) : null;
    return jsonResponse({ streamConfig });
  }

  if (req.method === "PUT") {
    const body = await req.json().catch(() => ({}));
    const {
      youtubeChannelId,
      youtubeLiveUrl,
      zoomJoinUrl,
      zoomWebinarId,
      googleMeetUrl,
      facebookPageId,
      facebookLiveUrl,
      tiktokLiveUrl,
      rtmpHlsUrl,
      customEmbedUrl,
      preferredPlatform,
      isActive,
    } = body as {
      youtubeChannelId?: string;
      youtubeLiveUrl?: string;
      zoomJoinUrl?: string;
      zoomWebinarId?: string;
      googleMeetUrl?: string;
      facebookPageId?: string;
      facebookLiveUrl?: string;
      tiktokLiveUrl?: string;
      rtmpHlsUrl?: string;
      customEmbedUrl?: string;
      preferredPlatform?: StreamPlatform;
      isActive?: boolean;
    };

    const validPlatforms: StreamPlatform[] = [
      "youtube",
      "zoom",
      "google_meet",
      "facebook",
      "rtmp",
      "custom",
      "tiktok",
    ];
    if (preferredPlatform && !validPlatforms.includes(preferredPlatform)) {
      return errorResponse("Invalid preferred_platform value", 400);
    }

    await conn.execute(
      `INSERT INTO gc_portal_stream_config
        (org_id, youtube_channel_id, youtube_live_url, zoom_join_url, zoom_webinar_id,
         google_meet_url, facebook_page_id, facebook_live_url, tiktok_live_url,
         rtmp_hls_url, custom_embed_url, preferred_platform, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         youtube_channel_id = VALUES(youtube_channel_id),
         youtube_live_url = VALUES(youtube_live_url),
         zoom_join_url = VALUES(zoom_join_url),
         zoom_webinar_id = VALUES(zoom_webinar_id),
         google_meet_url = VALUES(google_meet_url),
         facebook_page_id = VALUES(facebook_page_id),
         facebook_live_url = VALUES(facebook_live_url),
         tiktok_live_url = VALUES(tiktok_live_url),
         rtmp_hls_url = VALUES(rtmp_hls_url),
         custom_embed_url = VALUES(custom_embed_url),
         preferred_platform = VALUES(preferred_platform),
         is_active = VALUES(is_active),
         updated_at = CURRENT_TIMESTAMP`,
      [
        orgId,
        youtubeChannelId ?? null,
        youtubeLiveUrl ?? null,
        zoomJoinUrl ?? null,
        zoomWebinarId ?? null,
        googleMeetUrl ?? null,
        facebookPageId ?? null,
        facebookLiveUrl ?? null,
        tiktokLiveUrl ?? null,
        rtmpHlsUrl ?? null,
        customEmbedUrl ?? null,
        preferredPlatform ?? "youtube",
        isActive !== undefined ? (isActive ? 1 : 0) : 1,
      ]
    );

    const result = await conn.execute(
      "SELECT * FROM gc_portal_stream_config WHERE org_id = ? LIMIT 1",
      [orgId]
    );
    const streamConfig = result.rows.length > 0 ? rowToStreamConfig(result.rows[0] as any) : null;
    return jsonResponse({ streamConfig });
  }

  return errorResponse("Method not allowed", 405);
}
