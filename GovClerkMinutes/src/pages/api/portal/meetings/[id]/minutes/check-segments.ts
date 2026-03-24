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
      return jsonResponse({ hasSegments: false, segmentCount: 0 });
    }

    const broadcastId = Number((broadcastResult.rows[0] as { id: number }).id);

    const countResult = await conn.execute(
      "SELECT COUNT(*) as count FROM gc_broadcast_transcript_segments WHERE broadcast_id = ?",
      [broadcastId]
    );

    const segmentCount = Number((countResult.rows[0] as { count: number }).count);

    const response: CheckSegmentsResponse = {
      hasSegments: segmentCount > 0,
      segmentCount,
    };

    return jsonResponse(response);
  } catch (error) {
    console.error("[check-segments] Error:", error);
    return errorResponse("Failed to check broadcast segments", 500);
  }
}

export default withErrorReporting(handler);
