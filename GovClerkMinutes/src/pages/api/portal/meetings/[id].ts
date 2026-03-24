import withErrorReporting from "@/error/withErrorReporting";
import { getAuth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { resolveRequestContext } from "@/utils/resolveRequestContext";
import { errorResponse, jsonResponse } from "@/utils/apiHelpers";
import { formatMySQLDateTime } from "@/utils/dbQueries";
import { getPortalDbConnection, rowToPortalMeeting, rowToPortalArtifact } from "@/utils/portalDb";
import type {
  PortalMeetingWithArtifacts,
  UpdatePortalMeetingRequest,
  PortalMeetingResponse,
} from "@/types/portal";

interface PortalMeetingWithArtifactsResponse {
  meeting: PortalMeetingWithArtifacts;
}

export const config = {
  runtime: "edge",
};

async function handleGet(id: string, orgId: string): Promise<Response> {
  const conn = getPortalDbConnection();

  const result = await conn.execute(
    `SELECT id, org_id, portal_settings_id, board_id, title, description, meeting_date, location,
            is_public, tags, is_cancelled, created_at, updated_at, minutes_transcript_id, minutes_version
     FROM gc_meetings WHERE id = ? AND org_id = ?`,
    [id, orgId]
  );

  if (result.rows.length === 0) {
    return errorResponse("Meeting not found", 404);
  }

  // Fetch artifacts for this meeting with linked agenda items
  const artifactsResult = await conn.execute(
    `SELECT a.id, a.org_id, a.portal_settings_id, a.meeting_id, a.artifact_type, a.file_name,
            a.file_size, a.content_type, a.s3_key, a.s3_url, a.is_public, a.source_transcript_id,
            a.source_agenda_id, a.version, a.created_at, a.updated_at,
            aia.agenda_item_id as linked_agenda_item_id,
            ai.title as linked_agenda_item_title
     FROM gc_artifacts a
     LEFT JOIN gc_agenda_artifacts_group aia ON a.id = aia.artifact_id
     LEFT JOIN gc_agenda_items ai ON aia.agenda_item_id = ai.id
     WHERE a.meeting_id = ? AND a.org_id = ?
     ORDER BY a.created_at DESC`,
    [id, orgId]
  );

  const meeting = rowToPortalMeeting(result.rows[0]);
  const artifacts = artifactsResult.rows.map((row) => rowToPortalArtifact(row));

  const response: PortalMeetingWithArtifactsResponse = {
    meeting: {
      ...meeting,
      artifacts,
    },
  };

  return jsonResponse(response);
}

async function handlePut(
  id: string,
  orgId: string,
  body: UpdatePortalMeetingRequest
): Promise<Response> {
  const conn = getPortalDbConnection();

  const existing = await conn.execute("SELECT id FROM gc_meetings WHERE id = ? AND org_id = ?", [
    id,
    orgId,
  ]);

  if (existing.rows.length === 0) {
    return errorResponse("Meeting not found", 404);
  }

  if (!body.mgBoardId) {
    return errorResponse("Board is required", 400);
  }

  const updates: string[] = [];
  const values: any[] = [];

  if (body.title !== undefined) {
    updates.push("title = ?");
    values.push(body.title);
  }
  if (body.description !== undefined) {
    updates.push("description = ?");
    values.push(body.description);
  }
  if (body.meetingDate !== undefined) {
    updates.push("meeting_date = ?");
    values.push(formatMySQLDateTime(body.meetingDate));
  }
  if (body.location !== undefined) {
    updates.push("location = ?");
    values.push(body.location);
  }
  if (body.isPublic !== undefined) {
    updates.push("is_public = ?");
    values.push(body.isPublic);
  }
  if (body.tags !== undefined) {
    updates.push("tags = ?");
    values.push(body.tags ? JSON.stringify(body.tags) : null);
  }
  if (body.isCancelled !== undefined) {
    updates.push("is_cancelled = ?");
    values.push(body.isCancelled);
  }
  if (body.mgBoardId !== undefined) {
    updates.push("board_id = ?");
    values.push(body.mgBoardId);
  }
  if (body.minutesVersion !== undefined) {
    updates.push("minutes_version = ?");
    values.push(body.minutesVersion);
  }

  if (updates.length === 0) {
    return errorResponse("No fields to update", 400);
  }

  values.push(id, orgId);

  const result = await conn.transaction(async (tx) => {
    await tx.execute(
      `UPDATE gc_meetings SET ${updates.join(", ")} WHERE id = ? AND org_id = ?`,
      values
    );

    return tx.execute(
      `SELECT id, org_id, portal_settings_id, board_id, title, description, meeting_date, location,
              is_public, tags, is_cancelled, created_at, updated_at, minutes_transcript_id, minutes_version
       FROM gc_meetings WHERE id = ?`,
      [id]
    );
  });

  const response: PortalMeetingResponse = {
    meeting: rowToPortalMeeting(result.rows[0]),
  };

  return jsonResponse(response);
}

async function handleDelete(id: string, orgId: string): Promise<Response> {
  const conn = getPortalDbConnection();

  const existing = await conn.execute("SELECT id FROM gc_meetings WHERE id = ? AND org_id = ?", [
    id,
    orgId,
  ]);

  if (existing.rows.length === 0) {
    return errorResponse("Meeting not found", 404);
  }

  await conn.execute("DELETE FROM gc_meetings WHERE id = ? AND org_id = ?", [id, orgId]);

  return jsonResponse({ success: true });
}

async function handler(req: NextRequest): Promise<Response> {
  const auth = getAuth(req);
  if (!auth.userId) {
    return errorResponse("Unauthorized", 401);
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/");
  const id = pathParts[pathParts.length - 1];

  if (!id) {
    return errorResponse("Meeting ID is required", 400);
  }

  const body = req.method === "GET" ? {} : await req.json().catch(() => ({}));
  const orgIdParam = req.method === "GET" ? url.searchParams.get("orgId") : body.orgId;

  const { orgId } = await resolveRequestContext(auth.userId, orgIdParam, req.headers);

  if (!orgId) {
    return errorResponse("Organization context required", 400);
  }

  if (req.method === "GET") {
    return handleGet(id, orgId);
  }

  if (req.method === "PUT") {
    return handlePut(id, orgId, body);
  }

  if (req.method === "DELETE") {
    return handleDelete(id, orgId);
  }

  return errorResponse("Method not allowed", 405);
}

export default withErrorReporting(handler);
