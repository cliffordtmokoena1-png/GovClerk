import withErrorReporting from "@/error/withErrorReporting";
import { getAuth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { resolveRequestContext } from "@/utils/resolveRequestContext";
import { errorResponse, jsonResponse } from "@/utils/apiHelpers";
import { getPortalDbConnection } from "@/utils/portalDb";

export const config = {
  runtime: "edge",
};

type CheckSegmentsResponse = {
  hasSegments: boolean;
  segmentCount: number;
  speakerLabeledCount: number;
  estimatedDurationMs: number | null;
  quality: "good" | "fair" | "basic" | null;
};

async function handler(req: NextRequest): Promise<Response> {
  if (req.method !== "GET") {
    return errorResponse("Method not allowed", 405);
  }

  const auth = getAuth(req);
  if (!auth.userId) {
    return errorResponse("Unauthorized", 401);
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/");
  const meetingId = pathParts[pathParts.indexOf("meetings") + 1];
  const orgIdParam = url.searchParams.get("orgId");

  if (!meetingId) {
    return errorResponse("Meeting ID is required", 400);
  }

  const { orgId } = await resolveRequestContext(auth.userId, orgIdParam, req.headers);

  if (!orgId) {
    return errorResponse("Organization context required", 400);
  }

  const conn = getPortalDbConnection();

  try {
    const broadcastResult = await conn.execute(
      `SELECT id FROM gc_broadcasts 
       WHERE meeting_id = ? AND org_id = ? AND status IN ('active', 'ended')
       ORDER BY created_at DESC LIMIT 1`,
      [meetingId, orgId]
    );

    if (broadcastResult.rows.length === 0) {
      return jsonResponse<CheckSegmentsResponse>({
        hasSegments: false,
        segmentCount: 0,
        speakerLabeledCount: 0,
        estimatedDurationMs: null,
        quality: null,
      });
    }

    const broadcastId = Number((broadcastResult.rows[0] as { id: number }).id);

    const qualityResult = await conn.execute(
      `SELECT
         COUNT(*) as count,
         SUM(CASE WHEN speaker_label IS NOT NULL THEN 1 ELSE 0 END) as with_speaker,
         MIN(start_time) as min_start,
         MAX(end_time) as max_end
       FROM gc_broadcast_transcript_segments WHERE broadcast_id = ?`,
      [broadcastId]
    );

    const row = qualityResult.rows[0] as {
      count: number;
      with_speaker: number;
      min_start: number | null;
      max_end: number | null;
    };

    const segmentCount = Number(row.count);
    const speakerLabeledCount = Number(row.with_speaker ?? 0);
    const minStart = row.min_start !== null ? Number(row.min_start) : null;
    const maxEnd = row.max_end !== null ? Number(row.max_end) : null;
    const estimatedDurationMs =
      minStart !== null && maxEnd !== null ? Math.round((maxEnd - minStart) * 1000) : null;

    let quality: CheckSegmentsResponse["quality"] = null;
    if (segmentCount > 0) {
      const pct = speakerLabeledCount / segmentCount;
      quality = pct >= 0.8 ? "good" : pct >= 0.5 ? "fair" : "basic";
    }

    const response: CheckSegmentsResponse = {
      hasSegments: segmentCount > 0,
      segmentCount,
      speakerLabeledCount,
      estimatedDurationMs,
      quality,
    };

    return jsonResponse(response);
  } catch (error) {
    console.error("[check-segments] Error:", error);
    return errorResponse("Failed to check broadcast segments", 500);
  }
}

export default withErrorReporting(handler);
