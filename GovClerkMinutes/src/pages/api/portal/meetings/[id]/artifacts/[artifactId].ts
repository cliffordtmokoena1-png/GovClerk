import withErrorReporting from "@/error/withErrorReporting";
import { getAuth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { resolveRequestContext } from "@/utils/resolveRequestContext";
import { errorResponse, jsonResponse } from "@/utils/apiHelpers";
import { getPortalDbConnection, rowToPortalArtifact } from "@/utils/portalDb";

export const config = {
  runtime: "edge",
};

async function handlePatch(
  meetingId: string,
  artifactId: string,
  orgId: string,
  body: { isPublic?: boolean }
): Promise<Response> {
  const conn = getPortalDbConnection();

  // Verify meeting belongs to org
  const meetingResult = await conn.execute(
    "SELECT id FROM gc_meetings WHERE id = ? AND org_id = ?",
    [meetingId, orgId]
  );

  if (meetingResult.rows.length === 0) {
    return errorResponse("Meeting not found", 404);
  }

  // Verify artifact belongs to meeting and org
  const artifactResult = await conn.execute(
    `SELECT id, org_id, portal_settings_id, meeting_id, artifact_type, file_name, file_size,
            content_type, s3_key, s3_url, is_public, source_transcript_id, source_agenda_id,
            version, created_at, updated_at
     FROM gc_artifacts WHERE id = ? AND meeting_id = ? AND org_id = ?`,
    [artifactId, meetingId, orgId]
  );

  if (artifactResult.rows.length === 0) {
    return errorResponse("Artifact not found", 404);
  }

  // Build update query
  const updates: string[] = [];
  const params: any[] = [];

  if (typeof body.isPublic === "boolean") {
    updates.push("is_public = ?");
    params.push(body.isPublic ? 1 : 0);
  }

  if (updates.length === 0) {
    return errorResponse("No valid fields to update", 400);
  }

  updates.push("updated_at = ?");
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  params.push(now);

  params.push(artifactId, meetingId, orgId);

  await conn.execute(
    `UPDATE gc_artifacts SET ${updates.join(", ")} WHERE id = ? AND meeting_id = ? AND org_id = ?`,
    params
  );

  // Fetch updated artifact
  const updatedResult = await conn.execute(
    `SELECT id, org_id, portal_settings_id, meeting_id, artifact_type, file_name, file_size,
            content_type, s3_key, s3_url, is_public, source_transcript_id, source_agenda_id,
            version, created_at, updated_at
     FROM gc_artifacts WHERE id = ?`,
    [artifactId]
  );

  const artifact = rowToPortalArtifact(updatedResult.rows[0]);

  return jsonResponse({ artifact });
}

async function handleDelete(
  meetingId: string,
  artifactId: string,
  orgId: string
): Promise<Response> {
  const conn = getPortalDbConnection();

  // Verify meeting belongs to org
  const meetingResult = await conn.execute(
    "SELECT id FROM gc_meetings WHERE id = ? AND org_id = ?",
    [meetingId, orgId]
  );

  if (meetingResult.rows.length === 0) {
    return errorResponse("Meeting not found", 404);
  }

  // Verify artifact belongs to meeting and org
  const artifactResult = await conn.execute(
    "SELECT id, s3_key FROM gc_artifacts WHERE id = ? AND meeting_id = ? AND org_id = ?",
    [artifactId, meetingId, orgId]
  );

  if (artifactResult.rows.length === 0) {
    return errorResponse("Artifact not found", 404);
  }

  // Delete the artifact record from database
  // Note: S3 object deletion could be handled by a separate cleanup job if needed
  await conn.execute("DELETE FROM gc_artifacts WHERE id = ? AND meeting_id = ? AND org_id = ?", [
    artifactId,
    meetingId,
    orgId,
  ]);

  return jsonResponse({ success: true });
}

async function handler(req: NextRequest): Promise<Response> {
  const auth = getAuth(req);
  if (!auth.userId) {
    return errorResponse("Unauthorized", 401);
  }

  // Parse URL path: /api/portal/meetings/[id]/artifacts/[artifactId]
  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  // pathParts: ["api", "portal", "meetings", meetingId, "artifacts", artifactId]
  const meetingId = pathParts[3];
  const artifactId = pathParts[5];

  if (!meetingId || !artifactId) {
    return errorResponse("Meeting ID and Artifact ID are required", 400);
  }

  // Read body once for both PATCH and DELETE methods
  const body =
    req.method === "DELETE" || req.method === "PATCH" ? await req.json().catch(() => ({})) : {};

  // Try to get orgId from request body first, then fall back to Clerk auth context
  const orgIdParam = body.orgId || auth.orgId;

  const { orgId } = await resolveRequestContext(auth.userId, orgIdParam, req.headers);

  if (!orgId) {
    return errorResponse("Organization context required", 400);
  }

  if (req.method === "DELETE") {
    return handleDelete(meetingId, artifactId, orgId);
  }

  if (req.method === "PATCH") {
    return handlePatch(meetingId, artifactId, orgId, body);
  }

  return errorResponse("Method not allowed", 405);
}

export default withErrorReporting(handler);
