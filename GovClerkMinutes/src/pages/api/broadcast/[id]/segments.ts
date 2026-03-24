import withErrorReporting from "@/error/withErrorReporting";
import { getAuth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { resolveRequestContext } from "@/utils/resolveRequestContext";
import { errorResponse, jsonResponse } from "@/utils/apiHelpers";
import { getPortalDbConnection } from "@/utils/portalDb";
import type { Connection } from "@planetscale/database";

export const config = {
  runtime: "edge",
};

type TranscriptSegment = {
  id: number;
  broadcastId: number;
  segmentIndex: number;
  speakerId: string | null;
  speakerLabel: string | null;
  text: string;
  startTime: number | null;
  endTime: number | null;
  isFinal: boolean;
  createdAt: string;
};

async function handleGetSegments(
  conn: Connection,
  broadcastId: number,
  url: URL
): Promise<Response> {
  const limit = Number(url.searchParams.get("limit")) || 50;
  const beforeIndex = url.searchParams.get("beforeIndex")
    ? Number(url.searchParams.get("beforeIndex"))
    : null;

  let query = `SELECT
      id,
      broadcast_id as broadcastId,
      segment_index as segmentIndex,
      speaker_id as speakerId,
      speaker_label as speakerLabel,
      text,
      start_time as startTime,
      end_time as endTime,
      is_final as isFinal,
      created_at as createdAt
    FROM gc_broadcast_transcript_segments
    WHERE broadcast_id = ?`;

  const params: (number | string)[] = [broadcastId];

  if (beforeIndex !== null) {
    query += " AND segment_index < ?";
    params.push(beforeIndex);
  }

  query += " ORDER BY segment_index DESC LIMIT ?";
  params.push(limit);

  const segmentsResult = await conn.execute(query, params);

  const segments: TranscriptSegment[] = segmentsResult.rows.map((row: Record<string, unknown>) => ({
    id: Number(row.id),
    broadcastId: Number(row.broadcastId),
    segmentIndex: Number(row.segmentIndex),
    speakerId: row.speakerId as string | null,
    speakerLabel: row.speakerLabel as string | null,
    text: row.text as string,
    startTime: row.startTime ? Number(row.startTime) : null,
    endTime: row.endTime ? Number(row.endTime) : null,
    isFinal: Boolean(row.isFinal),
    createdAt: row.createdAt as string,
  }));

  return jsonResponse({ segments });
}

async function handler(req: NextRequest) {
  if (req.method !== "GET") {
    return errorResponse("Method not allowed", 405);
  }

  const auth = getAuth(req);
  if (!auth.userId) {
    return errorResponse("Unauthorized", 401);
  }

  const url = new URL(req.url);
  const orgIdParam = url.searchParams.get("orgId");

  const { orgId } = await resolveRequestContext(auth.userId, orgIdParam, req.headers);

  const pathParts = url.pathname.split("/");
  const broadcastId = Number.parseInt(pathParts[pathParts.indexOf("broadcast") + 1]);

  if (Number.isNaN(broadcastId)) {
    return errorResponse("Invalid broadcast ID", 400);
  }

  const conn = getPortalDbConnection();

  const broadcastResult = await conn.execute(
    "SELECT id FROM gc_broadcasts WHERE id = ? AND org_id = ?",
    [broadcastId, orgId]
  );

  if (broadcastResult.rows.length === 0) {
    return errorResponse("Broadcast not found", 404);
  }

  return handleGetSegments(conn, broadcastId, url);
}

export default withErrorReporting(handler);
