import withErrorReporting from "@/error/withErrorReporting";
import { getAuth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { resolveRequestContext } from "@/utils/resolveRequestContext";
import { errorResponse, jsonResponse } from "@/utils/apiHelpers";
import { getPortalDbConnection, rowToPortalArtifact } from "@/utils/portalDb";

export const config = {
  runtime: "edge",
};

interface AttachArtifactBody {
  artifactId: number;
  orgId?: string;
}

async function handleGet(meetingId: string, itemId: string, orgId: string): Promise<Response> {
  const conn = getPortalDbConnection();

  // Verify agenda item belongs to the meeting and org
  const itemCheck = await conn.execute(
    `SELECT ai.id FROM gc_agenda_items ai
     JOIN gc_agendas a ON ai.agenda_id = a.id
     WHERE ai.id = ? AND a.meeting_id = ? AND ai.org_id = ?`,
    [itemId, meetingId, orgId]
  );

  if (itemCheck.rows.length === 0) {
    return errorResponse("Agenda item not found", 404);
  }

  // Get attached artifacts
  const artifactsResult = await conn.execute(
    `SELECT ma.*, maia.ordinal as attachment_ordinal
     FROM gc_agenda_artifacts_group maia
     JOIN gc_artifacts ma ON maia.artifact_id = ma.id
     WHERE maia.agenda_item_id = ?
     ORDER BY maia.ordinal ASC`,
    [itemId]
  );

  const artifacts = artifactsResult.rows.map((row) => rowToPortalArtifact(row));

  return jsonResponse({ artifacts });
}

async function handlePost(
  meetingId: string,
  itemId: string,
  orgId: string,
  body: AttachArtifactBody
): Promise<Response> {
  const conn = getPortalDbConnection();

  // artifactId is required - clients must upload via /api/portal/artifacts/presign first
  if (!body.artifactId) {
    return errorResponse(
      "artifactId is required. Upload artifacts via /api/portal/artifacts/presign first, then link them here.",
      400
    );
  }

  // Verify agenda item belongs to the meeting and org
  const itemCheck = await conn.execute(
    `SELECT ai.id FROM gc_agenda_items ai
     JOIN gc_agendas a ON ai.agenda_id = a.id
     WHERE ai.id = ? AND a.meeting_id = ? AND ai.org_id = ?`,
    [itemId, meetingId, orgId]
  );

  if (itemCheck.rows.length === 0) {
    return errorResponse("Agenda item not found", 404);
  }

  // Verify artifact exists and belongs to this meeting/org
  const artifactCheck = await conn.execute(
    "SELECT id FROM gc_artifacts WHERE id = ? AND org_id = ? AND meeting_id = ?",
    [body.artifactId, orgId, meetingId]
  );

  if (artifactCheck.rows.length === 0) {
    return errorResponse("Artifact not found", 404);
  }

  // Check if already attached
  const existingLink = await conn.execute(
    "SELECT id FROM gc_agenda_artifacts_group WHERE agenda_item_id = ? AND artifact_id = ?",
    [itemId, body.artifactId]
  );

  if (existingLink.rows.length > 0) {
    return errorResponse("Artifact already attached", 400);
  }

  // Get max ordinal for this agenda item
  const maxOrdinalResult = await conn.execute(
    "SELECT COALESCE(MAX(ordinal), 0) as max_ordinal FROM gc_agenda_artifacts_group WHERE agenda_item_id = ?",
    [itemId]
  );
  const maxOrdinal = (maxOrdinalResult.rows[0] as any)?.max_ordinal ?? 0;

  // Create junction record
  await conn.execute(
    `INSERT INTO gc_agenda_artifacts_group (agenda_item_id, artifact_id, ordinal, created_at)
     VALUES (?, ?, ?, NOW())`,
    [itemId, body.artifactId, maxOrdinal + 1]
  );

  // Fetch and return the artifact
  const artifactResult = await conn.execute("SELECT * FROM gc_artifacts WHERE id = ?", [
    body.artifactId,
  ]);

  return jsonResponse({ artifact: rowToPortalArtifact(artifactResult.rows[0]) });
}

async function handleDelete(
  meetingId: string,
  itemId: string,
  orgId: string,
  body: { artifactId: number }
): Promise<Response> {
  const conn = getPortalDbConnection();

  if (!body.artifactId) {
    return errorResponse("artifactId is required", 400);
  }

  // Verify agenda item belongs to the meeting and org
  const itemCheck = await conn.execute(
    `SELECT ai.id FROM gc_agenda_items ai
     JOIN gc_agendas a ON ai.agenda_id = a.id
     WHERE ai.id = ? AND a.meeting_id = ? AND ai.org_id = ?`,
    [itemId, meetingId, orgId]
  );

  if (itemCheck.rows.length === 0) {
    return errorResponse("Agenda item not found", 404);
  }

  // Remove the junction record only
  const deleteResult = await conn.execute(
    "DELETE FROM gc_agenda_artifacts_group WHERE agenda_item_id = ? AND artifact_id = ?",
    [itemId, body.artifactId]
  );

  if ((deleteResult as any).rowsAffected === 0) {
    return errorResponse("Attachment not found", 404);
  }

  return jsonResponse({ success: true });
}

async function handler(req: NextRequest): Promise<Response> {
  const auth = getAuth(req);
  if (!auth.userId) {
    return errorResponse("Unauthorized", 401);
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/");
  // URL pattern: /api/portal/meetings/[id]/agenda-items/[itemId]/artifacts
  const agendaItemsIndex = pathParts.indexOf("agenda-items");
  const itemId = pathParts[agendaItemsIndex + 1];
  const meetingId = pathParts[agendaItemsIndex - 1];

  if (!meetingId || !itemId) {
    return errorResponse("Meeting ID and Item ID are required", 400);
  }

  const body = req.method === "GET" ? {} : await req.json().catch(() => ({}));
  const orgIdParam = req.method === "GET" ? url.searchParams.get("orgId") : body.orgId;

  const { orgId } = await resolveRequestContext(auth.userId, orgIdParam, req.headers);

  if (!orgId) {
    return errorResponse("Organization context required", 400);
  }

  if (req.method === "GET") {
    return handleGet(meetingId, itemId, orgId);
  }

  if (req.method === "POST") {
    return handlePost(meetingId, itemId, orgId, body);
  }

  if (req.method === "DELETE") {
    return handleDelete(meetingId, itemId, orgId, body);
  }

  return errorResponse("Method not allowed", 405);
}

export default withErrorReporting(handler);
