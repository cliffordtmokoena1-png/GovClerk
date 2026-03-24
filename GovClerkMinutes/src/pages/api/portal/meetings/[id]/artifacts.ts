import withErrorReporting from "@/error/withErrorReporting";
import { getAuth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { resolveRequestContext } from "@/utils/resolveRequestContext";
import { errorResponse, jsonResponse } from "@/utils/apiHelpers";
import { getPortalDbConnection, rowToPortalArtifact } from "@/utils/portalDb";

export const config = {
  runtime: "edge",
};

async function handleGet(meetingId: string, orgId: string): Promise<Response> {
  const conn = getPortalDbConnection();

  // Verify meeting exists and belongs to org
  const meetingResult = await conn.execute(
    "SELECT id FROM gc_meetings WHERE id = ? AND org_id = ?",
    [meetingId, orgId]
  );

  if (meetingResult.rows.length === 0) {
    return errorResponse("Meeting not found", 404);
  }

  // Fetch artifacts for this meeting with linked agenda items
  const artifactsResult = await conn.execute(
    `SELECT a.id, a.org_id, a.portal_settings_id, a.meeting_id, a.artifact_type, a.file_name, a.file_size,
            a.content_type, a.s3_key, a.s3_url, a.is_public, a.source_transcript_id, a.source_agenda_id,
            a.version, a.created_at, a.updated_at,
            aia.agenda_item_id as linked_agenda_item_id,
            ai.title as linked_agenda_item_title
     FROM gc_artifacts a
     LEFT JOIN gc_agenda_artifacts_group aia ON a.id = aia.artifact_id
     LEFT JOIN gc_agenda_items ai ON aia.agenda_item_id = ai.id
     WHERE a.meeting_id = ? AND a.org_id = ?
     ORDER BY a.created_at DESC`,
    [meetingId, orgId]
  );

  const artifacts = artifactsResult.rows.map((row: any) => {
    const linkedAgendaItem = row.linked_agenda_item_id
      ? { id: row.linked_agenda_item_id, title: row.linked_agenda_item_title }
      : undefined;
    return rowToPortalArtifact(row, linkedAgendaItem);
  });

  return jsonResponse({ artifacts });
}

async function handler(req: NextRequest): Promise<Response> {
  const auth = getAuth(req);
  if (!auth.userId) {
    return errorResponse("Unauthorized", 401);
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/");
  // Path: /api/portal/meetings/[id]/artifacts
  const meetingId = pathParts[pathParts.length - 2];

  if (!meetingId) {
    return errorResponse("Meeting ID is required", 400);
  }

  const body = req.method === "GET" ? {} : await req.json().catch(() => ({}));
  const orgIdParam = req.method === "GET" ? url.searchParams.get("orgId") : body.orgId;

  const { orgId } = await resolveRequestContext(auth.userId, orgIdParam, req.headers);

  if (!orgId) {
    return errorResponse("Organization context required", 400);
  }

  if (req.method === "GET") {
    return handleGet(meetingId, orgId);
  }

  return errorResponse("Method not allowed", 405);
}

export default withErrorReporting(handler);
