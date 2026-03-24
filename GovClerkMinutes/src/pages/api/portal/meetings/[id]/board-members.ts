import withErrorReporting from "@/error/withErrorReporting";
import { getAuth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { resolveRequestContext } from "@/utils/resolveRequestContext";
import { rowToBoardMember } from "@/utils/dbMappers";
import { errorResponse, jsonResponse } from "@/utils/apiHelpers";
import { getPortalDbConnection } from "@/utils/portalDb";
import type { BoardMember } from "@/board/types";
import type { BoardMemberRow } from "@/types/db";

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
  const pathParts = url.pathname.split("/");
  const boardMembersIndex = pathParts.indexOf("board-members");
  const meetingId = pathParts[boardMembersIndex - 1];

  if (!meetingId || isNaN(parseInt(meetingId))) {
    return errorResponse("Invalid meeting ID", 400);
  }

  const orgIdParam = url.searchParams.get("orgId");
  const { orgId } = await resolveRequestContext(auth.userId, orgIdParam, req.headers);

  if (!orgId) {
    return errorResponse("Organization context required", 400);
  }

  const conn = getPortalDbConnection();

  // Get meeting to verify org_id and get board_id
  const meetingResult = await conn.execute(
    "SELECT id, org_id, board_id FROM gc_meetings WHERE id = ?",
    [meetingId]
  );

  if (meetingResult.rows.length === 0) {
    return errorResponse("Meeting not found", 404);
  }

  const meeting = meetingResult.rows[0] as {
    id: number;
    org_id: string;
    board_id: number | null;
  };
  const boardId = meeting.board_id;

  if (!boardId) {
    return jsonResponse({ boardMembers: [] });
  }

  // Get board members
  const membersResult = await conn.execute(
    `SELECT id, org_id, board_id, user_id, title, start_date, end_date, created_at, updated_at
     FROM gc_board_members WHERE board_id = ? AND org_id = ?`,
    [boardId, orgId]
  );

  const boardMembers: BoardMember[] = membersResult.rows.map((row) =>
    rowToBoardMember(row as BoardMemberRow)
  );

  return jsonResponse({ boardMembers });
}

export default withErrorReporting(handler);
