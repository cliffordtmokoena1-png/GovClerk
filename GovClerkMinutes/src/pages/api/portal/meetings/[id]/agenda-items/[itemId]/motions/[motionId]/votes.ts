import withErrorReporting from "@/error/withErrorReporting";
import { getAuth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { resolveRequestContext } from "@/utils/resolveRequestContext";
import { rowToVote } from "@/utils/dbMappers";
import { getBoardMembersForMeeting } from "@/utils/dbQueries";
import { errorResponse, jsonResponse } from "@/utils/apiHelpers";
import { getPortalDbConnection } from "@/utils/portalDb";
import type { UpdateVoteInput } from "@/types/agenda";
import type { VoteRow } from "@/types/db";

export const config = {
  runtime: "edge",
};

async function handleGet(
  meetingId: string,
  agendaItemId: string,
  motionId: string,
  orgId: string
): Promise<Response> {
  const conn = getPortalDbConnection();

  // Verify motion exists and belongs to org/agenda item/meeting
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

  // Get votes for this motion
  const votesResult = await conn.execute(
    `SELECT id, org_id, motion_id, user_id, board_member_id, vote_value, created_at, updated_at
     FROM gc_votes WHERE motion_id = ? AND org_id = ? ORDER BY created_at ASC`,
    [motionId, orgId]
  );

  const votes = votesResult.rows.map((row) => rowToVote(row as VoteRow));

  // Get board members for this meeting (for potential voting)
  const boardMembers = await getBoardMembersForMeeting(conn, meetingId, orgId);

  return jsonResponse({ votes, boardMembers });
}

async function handlePut(
  meetingId: string,
  agendaItemId: string,
  motionId: string,
  orgId: string,
  body: UpdateVoteInput[] | UpdateVoteInput
): Promise<Response> {
  const conn = getPortalDbConnection();

  // Verify motion exists and belongs to org/agenda item/meeting
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

  // Get board members for validation
  const boardMembers = await getBoardMembersForMeeting(conn, meetingId, orgId);
  const boardMemberIds = new Set(boardMembers.map((m) => m.userId));

  // Handle single vote or bulk votes
  const votesToUpdate = Array.isArray(body) ? body : [body];

  await conn.transaction(async (tx) => {
    for (const voteUpdate of votesToUpdate) {
      if (!voteUpdate.user_id) {
        throw new Error("user_id is required");
      }

      // Validate board member
      if (!boardMemberIds.has(voteUpdate.user_id)) {
        throw new Error(`Board member ${voteUpdate.user_id} not found for this meeting`);
      }

      // Check if vote already exists
      const existingVote = await tx.execute(
        "SELECT id FROM gc_votes WHERE motion_id = ? AND user_id = ? AND org_id = ?",
        [motionId, voteUpdate.user_id, orgId]
      );

      if (existingVote.rows.length > 0) {
        // Update existing vote
        await tx.execute(
          `UPDATE gc_votes SET vote_value = ?, board_member_id = ?, updated_at = NOW()
           WHERE motion_id = ? AND user_id = ? AND org_id = ?`,
          [
            voteUpdate.vote_value,
            voteUpdate.board_member_id || null,
            motionId,
            voteUpdate.user_id,
            orgId,
          ]
        );
      } else {
        // Create new vote
        await tx.execute(
          `INSERT INTO gc_votes (org_id, motion_id, user_id, board_member_id, vote_value, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
          [
            orgId,
            motionId,
            voteUpdate.user_id,
            voteUpdate.board_member_id || null,
            voteUpdate.vote_value,
          ]
        );
      }
    }
  });

  // Get updated votes (vote counts are computed on-read, not stored)
  const votesResult = await conn.execute(
    `SELECT id, org_id, motion_id, user_id, board_member_id, vote_value, created_at, updated_at
     FROM gc_votes WHERE motion_id = ? AND org_id = ? ORDER BY created_at ASC`,
    [motionId, orgId]
  );

  const votes = votesResult.rows.map((row) => rowToVote(row as VoteRow));

  return jsonResponse({ votes });
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
  const motionId = pathParts[motionIndex + 1];

  if (!meetingId || !agendaItemId || !motionId) {
    return errorResponse("Meeting ID, Agenda Item ID, and Motion ID are required", 400);
  }

  const body = req.method === "GET" ? {} : await req.json().catch(() => ({}));
  const orgIdParam = req.method === "GET" ? url.searchParams.get("orgId") : body.orgId;

  const { orgId } = await resolveRequestContext(auth.userId, orgIdParam, req.headers);

  if (!orgId) {
    return errorResponse("Organization context required", 400);
  }

  if (req.method === "GET") {
    return handleGet(meetingId, agendaItemId, motionId, orgId);
  }

  if (req.method === "PUT") {
    return handlePut(meetingId, agendaItemId, motionId, orgId, body);
  }

  return errorResponse("Method not allowed", 405);
}

export default withErrorReporting(handler);
