import useSWR from "swr";
import type { LiveSessionResponse } from "@/types/liveSession";

async function fetchLiveSession(slug: string): Promise<LiveSessionResponse> {
  const res = await fetch(`/api/public/portal/${slug}/live`);
  if (!res.ok) {
    throw new Error("Failed to fetch live session");
  }
  return res.json();
}

export function useLiveSession(slug: string | undefined): {
  data: LiveSessionResponse | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
} {
  const { data, error, isLoading, mutate } = useSWR<LiveSessionResponse>(
    slug ? `live-session:${slug}` : null,
    slug ? () => fetchLiveSession(slug) : null,
    { refreshInterval: 10000 }
  );

  return {
    data: data ?? null,
    isLoading,
    error: error ?? null,
    refetch: () => mutate(),
  };
}
