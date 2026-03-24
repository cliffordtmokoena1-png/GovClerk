import withErrorReporting from "@/error/withErrorReporting";
import { getAuth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { resolveRequestContext } from "@/utils/resolveRequestContext";
import { errorResponse, jsonResponse } from "@/utils/apiHelpers";
import { getPortalDbConnection, rowToPortalArtifact } from "@/utils/portalDb";

export const config = {
  runtime: "edge",
};

interface UpdateAttachmentBody {
  ordinal?: number;
  orgId?: string;
}

async function handlePut(
  meetingId: string,
  itemId: string,
  artifactId: string,
  orgId: string,
  body: UpdateAttachmentBody
): Promise<Response> {
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

  // Verify the attachment exists
  const attachmentCheck = await conn.execute(
    "SELECT id, ordinal FROM gc_agenda_artifacts_group WHERE agenda_item_id = ? AND artifact_id = ?",
    [itemId, artifactId]
  );

  if (attachmentCheck.rows.length === 0) {
    return errorResponse("Artifact attachment not found", 404);
  }

  // Build dynamic update query
  const updates: string[] = [];
  const values: (string | number | null | undefined)[] = [];

  if (body.ordinal !== undefined) {
    updates.push("ordinal = ?");
    values.push(body.ordinal);
  }

  if (updates.length === 0) {
    return errorResponse("No updates provided", 400);
  }

  values.push(itemId, artifactId);

  await conn.execute(
    `UPDATE gc_agenda_artifacts_group SET ${updates.join(", ")} WHERE agenda_item_id = ? AND artifact_id = ?`,
    values
  );

  // Fetch and return the artifact
  const artifactResult = await conn.execute("SELECT * FROM gc_artifacts WHERE id = ?", [
    artifactId,
  ]);

  return jsonResponse({ artifact: rowToPortalArtifact(artifactResult.rows[0]) });
}

async function handleDelete(
  meetingId: string,
  itemId: string,
  artifactId: string,
  orgId: string
): Promise<Response> {
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

  // Remove the junction record only (detach artifact from agenda item)
  const deleteResult = await conn.execute(
    "DELETE FROM gc_agenda_artifacts_group WHERE agenda_item_id = ? AND artifact_id = ?",
    [itemId, artifactId]
  );

  if ((deleteResult as any).rowsAffected === 0) {
    return errorResponse("Artifact attachment not found", 404);
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

  // URL pattern: /api/portal/meetings/[id]/agenda-items/[itemId]/artifacts/[artifactId]
  const agendaItemsIndex = pathParts.indexOf("agenda-items");
  const artifactsIndex = pathParts.indexOf("artifacts");

  const meetingId = pathParts[agendaItemsIndex - 1];
  const itemId = pathParts[agendaItemsIndex + 1];
  const artifactId = pathParts[artifactsIndex + 1];

  if (!meetingId || !itemId || !artifactId) {
    return errorResponse("Meeting ID, Item ID, and Artifact ID are required", 400);
  }

  const body = await req.json().catch(() => ({}));
  const orgIdParam = body.orgId;

  const { orgId } = await resolveRequestContext(auth.userId, orgIdParam, req.headers);

  if (!orgId) {
    return errorResponse("Organization context required", 400);
  }

  if (req.method === "PUT") {
    return handlePut(meetingId, itemId, artifactId, orgId, body);
  }

  if (req.method === "DELETE") {
    return handleDelete(meetingId, itemId, artifactId, orgId);
  }

  return errorResponse("Method not allowed", 405);
}

export default withErrorReporting(handler);
