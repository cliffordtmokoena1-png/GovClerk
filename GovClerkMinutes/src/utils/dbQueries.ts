import { rowToBoardMember } from "@/utils/dbMappers";
import type { BoardMember } from "@/board/types";
import type { BoardMemberRow } from "@/types/db";
import type { Connection } from "@planetscale/database";

type DatabaseConnection = Connection | ReturnType<() => Connection>;

export async function getBoardMembersForMeeting(
  conn: DatabaseConnection,
  meetingId: string,
  orgId: string
): Promise<BoardMember[]> {
  const meetingResult = await conn.execute(
    "SELECT board_id FROM gc_meetings WHERE id = ? AND org_id = ?",
    [meetingId, orgId]
  );

  if (meetingResult.rows.length === 0) {
    return [];
  }

  const boardId = (meetingResult.rows[0] as { board_id: number | null }).board_id;
  if (!boardId) {
    return [];
  }

  const membersResult = await conn.execute(
    `SELECT user_id, title, start_date, end_date
     FROM gc_board_members WHERE board_id = ? AND org_id = ?`,
    [boardId, orgId]
  );

  return membersResult.rows.map((row) => rowToBoardMember(row as BoardMemberRow));
}

export function formatMySQLDateTime(input?: Date | string | null): string | null {
  if (!input) {
    return null;
  }
  const date = typeof input === "string" ? new Date(input) : input;
  return date.toISOString().slice(0, 19).replace("T", " ");
}
