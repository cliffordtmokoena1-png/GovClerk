import withErrorReporting from "@/error/withErrorReporting";
import { getAuth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { resolveRequestContext } from "@/utils/resolveRequestContext";
import { rowToMotion, rowToVote } from "@/utils/dbMappers";
import { errorResponse, jsonResponse } from "@/utils/apiHelpers";
import { getPortalDbConnection } from "@/utils/portalDb";
import type { CreateMotionInput, UpdateMotionInput, MotionWithVotes } from "@/types/agenda";
import type { MotionRow, VoteRow } from "@/types/db";

export const config = {
  runtime: "edge",
};

async function getMotionWithVotes(
  conn: ReturnType<typeof getPortalDbConnection>,
  motionId: string,
  orgId: string
): Promise<MotionWithVotes> {
  // Get motion with computed vote counts
  const motionResult = await conn.execute(
    `SELECT m.id, m.org_id, m.agenda_item_id, m.title, m.description, m.mover, m.seconder,
     m.is_withdrawn, m.is_tabled, m.ordinal, m.created_at, m.updated_at,
     (SELECT COUNT(*) FROM gc_votes v WHERE v.motion_id = m.id AND v.vote_value = 'yes') as votes_for,
     (SELECT COUNT(*) FROM gc_votes v WHERE v.motion_id = m.id AND v.vote_value = 'no') as votes_against,
     (SELECT COUNT(*) FROM gc_votes v WHERE v.motion_id = m.id AND v.vote_value = 'abstain') as votes_abstain
     FROM gc_motions m WHERE m.id = ? AND m.org_id = ?`,
    [motionId, orgId]
  );

  if (motionResult.rows.length === 0) {
    throw new Error("Motion not found");
  }

  const motion = rowToMotion(motionResult.rows[0] as MotionRow);

  // Get votes for this motion
  const votesResult = await conn.execute(
    `SELECT id, org_id, motion_id, user_id, board_member_id, vote_value, created_at, updated_at
     FROM gc_votes WHERE motion_id = ? AND org_id = ?`,
    [motionId, orgId]
  );

  const votes = votesResult.rows.map((row) => rowToVote(row as VoteRow));

  // Vote counts from the motion query
  const vote_counts = {
    yes: motion.votes_for ?? 0,
    no: motion.votes_against ?? 0,
    abstain: motion.votes_abstain ?? 0,
  };

  return {
    ...motion,
    votes,
    vote_counts,
  };
}

async function handleGet(
  meetingId: string,
  agendaItemId: string,
  orgId: string
): Promise<Response> {
  const conn = getPortalDbConnection();

  // Verify agenda item exists and belongs to org
  const agendaItemCheck = await conn.execute(
    `SELECT ai.id FROM gc_agenda_items ai
     JOIN gc_agendas a ON ai.agenda_id = a.id
     JOIN gc_meetings m ON a.meeting_id = m.id
     WHERE ai.id = ? AND a.meeting_id = ? AND a.org_id = ? AND m.org_id = ?`,
    [agendaItemId, meetingId, orgId, orgId]
  );

  if (agendaItemCheck.rows.length === 0) {
    return errorResponse("Agenda item not found", 404);
  }

  // Get motions for this agenda item with computed vote counts
  const motionsResult = await conn.execute(
    `SELECT m.id, m.org_id, m.agenda_item_id, m.title, m.description, m.mover, m.seconder,
     m.is_withdrawn, m.is_tabled, m.ordinal, m.created_at, m.updated_at,
     (SELECT COUNT(*) FROM gc_votes v WHERE v.motion_id = m.id AND v.vote_value = 'yes') as votes_for,
     (SELECT COUNT(*) FROM gc_votes v WHERE v.motion_id = m.id AND v.vote_value = 'no') as votes_against,
     (SELECT COUNT(*) FROM gc_votes v WHERE v.motion_id = m.id AND v.vote_value = 'abstain') as votes_abstain
     FROM gc_motions m WHERE m.agenda_item_id = ? AND m.org_id = ? ORDER BY m.ordinal ASC`,
    [agendaItemId, orgId]
  );

  const motions = motionsResult.rows.map((row) => rowToMotion(row as MotionRow));

  return jsonResponse({ motions });
}

async function handlePost(
  meetingId: string,
  agendaItemId: string,
  orgId: string,
  body: CreateMotionInput
): Promise<Response> {
  const conn = getPortalDbConnection();

  // Verify agenda item exists and belongs to org
  const agendaItemCheck = await conn.execute(
    `SELECT ai.id FROM gc_agenda_items ai
     JOIN gc_agendas a ON ai.agenda_id = a.id
     JOIN gc_meetings m ON a.meeting_id = m.id
     WHERE ai.id = ? AND a.meeting_id = ? AND a.org_id = ? AND m.org_id = ?`,
    [agendaItemId, meetingId, orgId, orgId]
  );

  if (agendaItemCheck.rows.length === 0) {
    return errorResponse("Agenda item not found", 404);
  }

  // Get max ordinal for this agenda item
  const maxOrdinalResult = await conn.execute(
    "SELECT MAX(ordinal) as max_ordinal FROM gc_motions WHERE agenda_item_id = ? AND org_id = ?",
    [agendaItemId, orgId]
  );

  const maxOrdinal = maxOrdinalResult.rows[0].max_ordinal || 0;
  const newOrdinal = body.ordinal || maxOrdinal + 1;

  const result = await conn.execute(
    `INSERT INTO gc_motions (org_id, agenda_item_id, title, description, mover, seconder, is_withdrawn, is_tabled, ordinal, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, NOW(), NOW())`,
    [
      orgId,
      agendaItemId,
      body.title,
      body.description || null,
      body.mover || null,
      body.seconder || null,
      newOrdinal,
    ]
  );

  const newMotionId = result.insertId;
  const newMotion = await getMotionWithVotes(conn, newMotionId.toString(), orgId);

  return jsonResponse({ motion: newMotion }, 201);
}

async function handlePut(
  meetingId: string,
  agendaItemId: string,
  motionId: string,
  orgId: string,
  body: UpdateMotionInput
): Promise<Response> {
  const conn = getPortalDbConnection();

  // Verify motion exists and belongs to org/agenda item
  const motionCheck = await conn.execute(
    `SELECT m.id FROM gc_motions m
     JOIN gc_agenda_items ai ON m.agenda_item_id = ai.id
     JOIN gc_agendas a ON ai.agenda_id = a.id
     JOIN gc_meetings m2 ON a.meeting_id = m2.id
     WHERE m.id = ? AND m.agenda_item_id = ? AND a.meeting_id = ? AND m.org_id = ? AND m2.org_id = ?`,
    [motionId, agendaItemId, meetingId, orgId, orgId]
  );

  if (motionCheck.rows.length === 0) {
    return errorResponse("Motion not found", 404);
  }

  // Build dynamic update query
  const updates: string[] = [];
  const values: (string | number | null | undefined | boolean)[] = [];

  if (body.title !== undefined) {
    updates.push("title = ?");
    values.push(body.title);
  }
  if (body.description !== undefined) {
    updates.push("description = ?");
    values.push(body.description);
  }
  if (body.mover !== undefined) {
    updates.push("mover = ?");
    values.push(body.mover);
  }
  if (body.seconder !== undefined) {
    updates.push("seconder = ?");
    values.push(body.seconder);
  }
  if (body.is_withdrawn !== undefined) {
    updates.push("is_withdrawn = ?");
    values.push(body.is_withdrawn ? 1 : 0);
  }
  if (body.is_tabled !== undefined) {
    updates.push("is_tabled = ?");
    values.push(body.is_tabled ? 1 : 0);
  }
  if (body.ordinal !== undefined) {
    updates.push("ordinal = ?");
    values.push(body.ordinal);
  }

  if (updates.length === 0) {
    return errorResponse("No updates provided", 400);
  }

  updates.push("updated_at = NOW()");
  values.push(motionId, agendaItemId, orgId);

  await conn.execute(
    `UPDATE gc_motions SET ${updates.join(", ")} WHERE id = ? AND agenda_item_id = ? AND org_id = ?`,
    values
  );

  const updatedMotion = await getMotionWithVotes(conn, motionId, orgId);

  return jsonResponse({ motion: updatedMotion });
}

async function handleDelete(
  meetingId: string,
  agendaItemId: string,
  motionId: string,
  orgId: string
): Promise<Response> {
  const conn = getPortalDbConnection();

  // Verify motion exists and belongs to org/agenda item
  const motionCheck = await conn.execute(
    `SELECT m.id FROM gc_motions m
     JOIN gc_agenda_items ai ON m.agenda_item_id = ai.id
     JOIN gc_agendas a ON ai.agenda_id = a.id
     JOIN gc_meetings m2 ON a.meeting_id = m2.id
     WHERE m.id = ? AND m.agenda_item_id = ? AND a.meeting_id = ? AND m.org_id = ? AND m2.org_id = ?`,
    [motionId, agendaItemId, meetingId, orgId, orgId]
  );

  if (motionCheck.rows.length === 0) {
    return errorResponse("Motion not found", 404);
  }

  // Delete votes first (foreign key constraint)
  await conn.execute("DELETE FROM gc_votes WHERE motion_id = ? AND org_id = ?", [motionId, orgId]);

  // Delete motion
  await conn.execute("DELETE FROM gc_motions WHERE id = ? AND org_id = ?", [motionId, orgId]);

  return jsonResponse({ success: true });
}

async function handler(req: NextRequest): Promise<Response> {
  const auth = getAuth(req);
  if (!auth.userId) {
    return errorResponse("Unauthorized", 401);
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/");
  const agendaItemIndex = pathParts.indexOf("agenda-items");
  const agendaItemId = pathParts[agendaItemIndex + 1];
  const meetingId = pathParts[agendaItemIndex - 1];
  const motionIndex = pathParts.indexOf("motions");

  if (!meetingId || !agendaItemId) {
    return errorResponse("Meeting ID and Agenda Item ID are required", 400);
  }

  const body = req.method === "GET" ? {} : await req.json().catch(() => ({}));
  const orgIdParam = req.method === "GET" ? url.searchParams.get("orgId") : body.orgId;

  const { orgId } = await resolveRequestContext(auth.userId, orgIdParam, req.headers);

  if (!orgId) {
    return errorResponse("Organization context required", 400);
  }

  // Check if this is a specific motion request (for PUT/DELETE)
  if (motionIndex < pathParts.length - 1) {
    const motionId = pathParts[motionIndex + 1];

    if (req.method === "PUT") {
      return handlePut(meetingId, agendaItemId, motionId, orgId, body);
    }

    if (req.method === "DELETE") {
      return handleDelete(meetingId, agendaItemId, motionId, orgId);
    }

    return errorResponse("Method not allowed", 405);
  }

  if (req.method === "GET") {
    return handleGet(meetingId, agendaItemId, orgId);
  }

  if (req.method === "POST") {
    return handlePost(meetingId, agendaItemId, orgId, body);
  }

  return errorResponse("Method not allowed", 405);
}

export default withErrorReporting(handler);
