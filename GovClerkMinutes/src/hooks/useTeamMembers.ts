import { useCallback } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import type {
  TeamMember,
  TeamMembersListResponse,
  AddTeamMemberRequest,
  TeamMemberRole,
} from "@/pages/api/team-members/index";

const fetcher = async (url: string): Promise<TeamMember[]> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to fetch team members");
  }
  const data = (await response.json()) as TeamMembersListResponse;
  return data.members;
};

export function useTeamMembers() {
  const { data, error, isLoading, mutate } = useSWR<TeamMember[]>(
    "/api/team-members",
    fetcher,
    { revalidateOnFocus: false }
  );

  const addMember = useCallback(
    async (request: AddTeamMemberRequest): Promise<TeamMember> => {
      const response = await fetch("/api/team-members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message = (errorData as { error?: string }).error || "Failed to add team member";
        toast.error(message);
        throw new Error(message);
      }

      const result = (await response.json()) as { member: TeamMember };
      await mutate();
      toast.success("Team member invited");
      return result.member;
    },
    [mutate]
  );

  const updateMember = useCallback(
    async (id: number, updates: { role?: TeamMemberRole; status?: "active" | "revoked" }): Promise<TeamMember> => {
      const response = await fetch(`/api/team-members/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message = (errorData as { error?: string }).error || "Failed to update team member";
        toast.error(message);
        throw new Error(message);
      }

      const result = (await response.json()) as { member: TeamMember };
      await mutate();
      toast.success("Team member updated");
      return result.member;
    },
    [mutate]
  );

  const removeMember = useCallback(
    async (id: number): Promise<void> => {
      const response = await fetch(`/api/team-members/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message = (errorData as { error?: string }).error || "Failed to remove team member";
        toast.error(message);
        throw new Error(message);
      }

      await mutate();
      toast.success("Team member removed");
    },
    [mutate]
  );

  return {
    members: data ?? [],
    isLoading,
    error,
    mutate,
    addMember,
    updateMember,
    removeMember,
  } as const;
}
