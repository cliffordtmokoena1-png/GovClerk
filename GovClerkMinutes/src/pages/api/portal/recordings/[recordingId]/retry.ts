import withErrorReporting from "@/error/withErrorReporting";
import { getAuth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { resolveRequestContext } from "@/utils/resolveRequestContext";
import { errorResponse, jsonResponse } from "@/utils/apiHelpers";
import { getPortalDbConnection } from "@/utils/portalDb";
import { getSophonHttpUrl } from "@/sophon/config";

export const config = {
  runtime: "edge",
};

async function handler(req: NextRequest): Promise<Response> {
  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  const auth = getAuth(req);
  if (!auth.userId) {
    return errorResponse("Unauthorized", 401);
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/");
  const recordingId = pathParts[pathParts.length - 2];

  if (!recordingId) {
    return errorResponse("Recording ID is required", 400);
  }

  const body = await req.json().catch(() => ({}));
  const { orgId } = await resolveRequestContext(auth.userId, body.orgId, req.headers);

  if (!orgId) {
    return errorResponse("Organization context required", 400);
  }

  const conn = getPortalDbConnection();

  const recordingResult = await conn.execute(
    `SELECT r.id, r.status, b.org_id
     FROM gc_broadcast_recordings r
     JOIN gc_broadcasts b ON b.id = r.broadcast_id
     WHERE r.id = ? AND b.org_id = ?`,
    [recordingId, orgId]
  );

  if (recordingResult.rows.length === 0) {
    return errorResponse("Recording not found", 404);
  }

  const recording = recordingResult.rows[0] as any;
  if (recording.status !== "failed") {
    return errorResponse("Recording is not in failed state", 400);
  }

  const response = await fetch(`${getSophonHttpUrl()}/recording/reprocess`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recordingId: Number(recordingId) }),
  });

  if (!response.ok) {
    return errorResponse("Failed to trigger reprocessing", 500);
  }

  return jsonResponse({ ok: true, recordingId: Number(recordingId) });
}

export default withErrorReporting(handler);
