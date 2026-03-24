import withErrorReporting from "@/error/withErrorReporting";
import { getAuth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { resolveRequestContext } from "@/utils/resolveRequestContext";
import { errorResponse, jsonResponse } from "@/utils/apiHelpers";
import { getPortalDbConnection } from "@/utils/portalDb";

export const config = {
  runtime: "edge",
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
  const orgIdParam = url.searchParams.get("orgId");
  const meetingId = url.searchParams.get("meetingId");

  if (!meetingId) {
    return errorResponse("meetingId is required", 400);
  }

  const { orgId } = await resolveRequestContext(auth.userId, orgIdParam, req.headers);

  if (!orgId) {
    return errorResponse("Organization required", 400);
  }

  const conn = getPortalDbConnection();

  const meetingCheck = await conn.execute(
    "SELECT id FROM gc_meetings WHERE id = ? AND org_id = ?",
    [meetingId, orgId]
  );

  if (meetingCheck.rows.length === 0) {
    return errorResponse("Meeting not found", 404);
  }

  const segmentCountResult = await conn.execute(
    `SELECT COUNT(*) as count 
     FROM gc_broadcast_transcript_segments s
     INNER JOIN gc_broadcasts b ON s.broadcast_id = b.id
     WHERE b.meeting_id = ?`,
    [meetingId]
  );

  const segmentCount = Number((segmentCountResult.rows[0] as { count: number }).count);

  return jsonResponse({
    hasExistingSegments: segmentCount > 0,
    segmentCount,
  });
}

export default withErrorReporting(handler);
