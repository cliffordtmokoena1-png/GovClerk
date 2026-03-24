import { useState, useCallback, useMemo } from "react";
import useSWR from "swr";
import type { PublicPortalResponse, PublicMeetingsListResponse } from "@/types/portal";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const error = new Error("Failed to fetch");
    throw error;
  }
  return res.json();
};

export interface MeetingsFilter {
  search?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: "newest" | "oldest";
  page?: number;
  limit?: number;
  year?: number;
  month?: number;
  selectedTags?: string[];
}

export function usePublicPortalSettings(slug: string | undefined) {
  const { data, error, isLoading } = useSWR<PublicPortalResponse>(
    slug ? `/api/public/portal/${slug}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  return {
    settings: data?.settings ?? null,
    isLoading,
    error,
  };
}

export function usePublicPortalMeetings(slug: string | undefined, initialFilter?: MeetingsFilter) {
  const [filter, setFilter] = useState<MeetingsFilter>(
    initialFilter ?? { page: 1, limit: 10, sortBy: "newest" }
  );

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (filter.search) {
      params.set("search", filter.search);
    }
    if (filter.startDate) {
      params.set("startDate", filter.startDate);
    }
    if (filter.endDate) {
      params.set("endDate", filter.endDate);
    }
    if (filter.sortBy) {
      params.set("sortBy", filter.sortBy);
    }
    if (filter.page) {
      params.set("page", String(filter.page));
    }
    if (filter.limit) {
      params.set("pageSize", String(filter.limit));
    }
    if (filter.year) {
      params.set("year", String(filter.year));
    }
    if (filter.month) {
      params.set("month", String(filter.month));
    }
    if (filter.selectedTags && filter.selectedTags.length > 0) {
      params.set("tags", filter.selectedTags.join(","));
    }
    return params.toString();
  }, [filter]);

  const { data, error, isLoading, mutate } = useSWR<PublicMeetingsListResponse>(
    slug ? `/api/public/portal/${slug}/meetings?${queryString}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const updateFilter = useCallback((updates: Partial<MeetingsFilter>) => {
    setFilter((prev) => ({ ...prev, ...updates, page: updates.page ?? 1 }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilter({ page: 1, limit: 10, sortBy: "newest" });
  }, []);

  const goToPage = useCallback((page: number) => {
    setFilter((prev) => ({ ...prev, page }));
  }, []);

  return {
    meetings: data?.meetings ?? [],
    total: data?.total ?? 0,
    page: data?.page ?? 1,
    pageSize: data?.pageSize ?? 10,
    filter,
    updateFilter,
    clearFilters,
    goToPage,
    isLoading,
    error,
    refetch: mutate,
  };
}

export function usePublicPortal(slug: string | undefined, initialFilter?: MeetingsFilter) {
  const {
    settings,
    isLoading: settingsLoading,
    error: settingsError,
  } = usePublicPortalSettings(slug);
  const meetingsData = usePublicPortalMeetings(slug, initialFilter);

  return {
    settings,
    ...meetingsData,
    isLoading: settingsLoading || meetingsData.isLoading,
    error: settingsError || meetingsData.error,
  };
}
