import { useCallback } from "react";
import { toast } from "sonner";
import useSWR, { mutate as globalMutate } from "swr";

import type { MgVote, UpdateVoteInput, VoteType } from "@/types/agenda";
import type { BoardMember } from "@/board/types";
import { useOrgContext } from "@/contexts/OrgContext";

interface VotesResponse {
  votes: MgVote[];
  boardMembers: BoardMember[];
}

const fetcher = async (url: string): Promise<VotesResponse> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to fetch votes");
  }
  return response.json();
};

export function useVotes(
  meetingId: number | null,
  agendaItemId: number | null,
  motionId: number | null
) {
  const { orgId } = useOrgContext();

  const url =
    meetingId && agendaItemId && motionId && orgId
      ? `/api/portal/meetings/${meetingId}/agenda-items/${agendaItemId}/motions/${motionId}/votes?orgId=${orgId}`
      : null;

  const { data, error, isLoading, mutate } = useSWR<VotesResponse>(url, fetcher, {
    revalidateOnFocus: false,
  });

  const updateVotes = useCallback(
    async (votes: UpdateVoteInput[]): Promise<MgVote[]> => {
      if (!meetingId || !agendaItemId || !motionId) {
        throw new Error("Meeting ID, Agenda Item ID, and Motion ID are required");
      }

      const response = await fetch(
        `/api/portal/meetings/${meetingId}/agenda-items/${agendaItemId}/motions/${motionId}/votes`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...votes, orgId }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message = errorData.error || "Failed to update votes";
        toast.error(message);
        throw new Error(message);
      }

      const result: { votes: MgVote[] } = await response.json();
      await mutate();

      toast.success("Votes updated");

      return result.votes;
    },
    [meetingId, agendaItemId, motionId, orgId, mutate]
  );

  const updateVote = useCallback(
    async (boardMemberId: string, voteType: VoteType): Promise<MgVote[]> => {
      return updateVotes([{ user_id: boardMemberId, vote_value: voteType }]);
    },
    [updateVotes]
  );

  const setAllVotes = useCallback(
    async (voteType: VoteType): Promise<MgVote[]> => {
      const boardMembers = data?.boardMembers ?? [];
      const votes = boardMembers.map((member) => ({
        user_id: member.userId,
        vote_value: voteType as VoteType,
      }));

      return updateVotes(votes);
    },
    [data?.boardMembers, updateVotes]
  );

  const resetVotes = useCallback(async (): Promise<MgVote[]> => {
    // Reset to uncast (null) instead of abstain
    const boardMembers = data?.boardMembers ?? [];
    const votes = boardMembers.map((member) => ({
      user_id: member.userId,
      vote_value: null as VoteType | null,
    }));
    return updateVotes(votes);
  }, [data?.boardMembers, updateVotes]);

  const getVoteCounts = useCallback(() => {
    const votes = data?.votes ?? [];

    const counts = {
      yes: votes.filter((v) => v.vote_value === "yes").length,
      no: votes.filter((v) => v.vote_value === "no").length,
      abstain: votes.filter((v) => v.vote_value === "abstain").length,
      absent: votes.filter((v) => v.vote_value === "absent").length,
      uncast: votes.filter((v) => v.vote_value === null).length,
      total: votes.length,
    };

    // Only count cast votes for majority calculation
    const castVotes = counts.yes + counts.no + counts.abstain;
    const majority = counts.yes > counts.no ? "yes" : counts.no > counts.yes ? "no" : "tie";
    // Standard parliamentary procedure: motion passes when yes votes exceed no votes
    const passed = counts.yes > counts.no;

    return {
      ...counts,
      castVotes,
      majority,
      passed,
      hasQuorum: castVotes > 0,
    };
  }, [data?.votes]);

  const getBoardMemberVote = useCallback(
    (boardMemberId: string): VoteType | null | undefined => {
      const votes = data?.votes ?? [];
      const vote = votes.find(
        (v) => v.user_id === boardMemberId || v.board_member_id?.toString() === boardMemberId
      );
      // Return undefined if no vote record exists, null if vote exists but is uncast
      if (!vote) {
        return undefined;
      }
      return vote.vote_value;
    },
    [data?.votes]
  );

  const getUnvotedMembers = useCallback((): BoardMember[] => {
    const boardMembers = data?.boardMembers ?? [];
    const votes = data?.votes ?? [];
    // Members with no vote record OR with null vote_value are considered "unvoted"
    const castVoteIds = new Set(votes.filter((v) => v.vote_value !== null).map((v) => v.user_id));

    return boardMembers.filter((member) => !castVoteIds.has(member.userId));
  }, [data?.boardMembers, data?.votes]);

  return {
    votes: data?.votes ?? [],
    boardMembers: data?.boardMembers ?? [],
    isLoading,
    error,
    mutate,
    updateVotes,
    updateVote,
    setAllVotes,
    resetVotes,
    getVoteCounts,
    getBoardMemberVote,
    getUnvotedMembers,
  } as const;
}
