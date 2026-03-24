import type { BoardMember } from "@/board/types";
import type { MgMotion, MgVote, VoteType } from "@/types/agenda";
import type { BoardMemberRow, MotionRow, VoteRow } from "@/types/db";

export function rowToBoardMember(row: BoardMemberRow): BoardMember {
  return {
    userId: row.user_id,
    email: row.user_id,
    title: row.title || "",
    startDate: row.start_date || "",
    endDate: row.end_date || "",
  };
}

export function rowToMotion(row: MotionRow): MgMotion {
  return {
    id: row.id,
    org_id: row.org_id,
    agenda_item_id: row.agenda_item_id,
    title: row.title,
    description: row.description,
    mover: row.mover,
    seconder: row.seconder,
    is_withdrawn: Boolean(row.is_withdrawn),
    is_tabled: Boolean(row.is_tabled),
    ordinal: row.ordinal,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),

    votes_for: row.votes_for ?? 0,
    votes_against: row.votes_against ?? 0,
    votes_abstain: row.votes_abstain ?? 0,
  };
}

export function rowToVote(row: VoteRow): MgVote {
  return {
    id: row.id,
    org_id: row.org_id,
    motion_id: row.motion_id,
    user_id: row.user_id,
    board_member_id: row.board_member_id,
    vote_value: row.vote_value as VoteType | null,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  };
}
