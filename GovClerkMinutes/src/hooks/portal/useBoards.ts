import useSWR from "swr";
import { useOrgContext } from "@/contexts/OrgContext";
import type { Board } from "@/board/types";

const fetcher = async (url: string): Promise<Board[]> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to fetch boards");
  }
  return response.json();
};

export function useBoards() {
  const { orgId } = useOrgContext();
  const url = orgId ? "/api/org/boards" : null;

  const { data, error, isLoading, mutate } = useSWR<Board[]>(url, fetcher, {
    revalidateOnFocus: false,
  });

  return {
    boards: data || [],
    isLoading,
    error,
    mutate,
  } as const;
}
