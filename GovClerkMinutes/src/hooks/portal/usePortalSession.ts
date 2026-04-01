import useSWR from "swr";
import type { PortalSessionResponse } from "@/types/portal";

const fetcher = async (url: string): Promise<PortalSessionResponse> => {
  const res = await fetch(url);
  if (res.status === 401) {
    return { isAuthenticated: false };
  }
  if (!res.ok) {
    throw new Error("Failed to fetch session");
  }
  return res.json();
};

export function usePortalSession() {
  const { data, error, isLoading, mutate } = useSWR<PortalSessionResponse>(
    "/api/portal/auth/me",
    fetcher,
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
    }
  );

  return {
    session: data ?? null,
    isLoading,
    error,
    refresh: mutate,
  };
}
