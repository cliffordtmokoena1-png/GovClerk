import { NextRequest } from "next/server";
import { getAuth } from "@clerk/nextjs/server";
import { errorResponse, jsonResponse } from "@/utils/apiHelpers";
import { getPortalDbConnection } from "@/utils/portalDb";
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

async function handler(req: NextRequest): Promise<Response> {
  const { orgId } = getAuth(req as any);
  if (!orgId) {
    return errorResponse("Unauthorized", 401);
  }

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
    // Updating stream config requires an active subscription
    const subCheck = await conn.execute(
      "SELECT id FROM gc_portal_subscriptions WHERE org_id = ? AND status IN ('active', 'trial') LIMIT 1",
      [orgId]
    );
    if (subCheck.rows.length === 0) {
      return new Response(
        JSON.stringify({
          error:
            "This feature requires an active subscription. Please subscribe to access the Live Portal.",
          code: "SUBSCRIPTION_REQUIRED",
        }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
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

export default handler;
