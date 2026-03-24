import useSWR from "swr";
import { useOrgContext } from "@/contexts/OrgContext";
import type { BoardMember } from "@/board/types";

interface UseBoardMembersProps {
  meetingId: number;
}

interface BoardMembersResponse {
  boardMembers: BoardMember[];
}

export function useBoardMembers({ meetingId }: UseBoardMembersProps) {
  const { orgId } = useOrgContext();

  const { data, error, mutate, isLoading } = useSWR<BoardMembersResponse>(
    orgId && meetingId ? `/api/portal/meetings/${meetingId}/board-members?orgId=${orgId}` : null,
    async (url: string) => {
      const response = await fetch(url, {
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to fetch board members");
      }

      return response.json();
    }
  );

  return {
    boardMembers: data?.boardMembers ?? [],
    isLoading,
    error,
    mutate,
  } as const;
}
