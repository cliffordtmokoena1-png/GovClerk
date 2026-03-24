import { useCallback, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";

import {
  PortalMeeting,
  PortalMeetingWithArtifacts,
  PortalMeetingsWithArtifactsListResponse,
  CreatePortalMeetingRequest,
  UpdatePortalMeetingRequest,
} from "@/types/portal";
import { useOrgContext } from "@/contexts/OrgContext";

type PaginationParams = {
  page?: number;
  pageSize?: number;
  sortBy?: "meetingDate" | "createdAt";
  sortOrder?: "asc" | "desc";
};

const buildUrl = (orgId: string, params: PaginationParams) => {
  const searchParams = new URLSearchParams();
  searchParams.set("orgId", orgId);
  if (params.page) {
    searchParams.set("page", params.page.toString());
  }
  if (params.pageSize) {
    searchParams.set("pageSize", params.pageSize.toString());
  }
  if (params.sortBy) {
    searchParams.set("sortBy", params.sortBy);
  }
  if (params.sortOrder) {
    searchParams.set("sortOrder", params.sortOrder);
  }
  return `/api/portal/meetings?${searchParams.toString()}`;
};

const fetcher = async (url: string): Promise<PortalMeetingsWithArtifactsListResponse> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to fetch portal meetings");
  }
  return response.json();
};

export function usePortalMeetings(initialParams: PaginationParams = {}) {
  const { orgId } = useOrgContext();
  const [params, setParams] = useState<PaginationParams>({
    page: 1,
    pageSize: 10,
    sortBy: "meetingDate",
    sortOrder: "desc",
    ...initialParams,
  });

  const url = orgId ? buildUrl(orgId, params) : null;

  const { data, error, isLoading, mutate } = useSWR<PortalMeetingsWithArtifactsListResponse>(
    url,
    fetcher,
    {
      revalidateOnFocus: false,
    }
  );

  const createMeeting = useCallback(
    async (request: CreatePortalMeetingRequest): Promise<PortalMeeting> => {
      const response = await fetch("/api/portal/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...request, orgId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message = errorData.error || "Failed to create meeting";
        toast.error(message);
        throw new Error(message);
      }

      const result = await response.json();
      await mutate();
      toast.success("Meeting created");
      return result.meeting;
    },
    [orgId, mutate]
  );

  const updateMeeting = useCallback(
    async (id: number, request: UpdatePortalMeetingRequest): Promise<PortalMeeting> => {
      const response = await fetch(`/api/portal/meetings/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...request, orgId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message = errorData.error || "Failed to update meeting";
        toast.error(message);
        throw new Error(message);
      }

      const result = await response.json();
      await mutate();
      toast.success("Meeting updated");
      return result.meeting;
    },
    [orgId, mutate]
  );

  const deleteMeeting = useCallback(
    async (id: number): Promise<void> => {
      const response = await fetch(`/api/portal/meetings/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message = errorData.error || "Failed to delete meeting";
        toast.error(message);
        throw new Error(message);
      }

      await mutate();
      toast.success("Meeting deleted");
    },
    [mutate]
  );

  const toggleVisibility = useCallback(
    async (id: number, isPublic: boolean): Promise<void> => {
      await updateMeeting(id, { isPublic });
    },
    [updateMeeting]
  );

  const setPage = useCallback((page: number) => {
    setParams((prev) => ({ ...prev, page }));
  }, []);

  const setPageSize = useCallback((pageSize: number) => {
    setParams((prev) => ({ ...prev, pageSize, page: 1 }));
  }, []);

  const setSorting = useCallback(
    (sortBy: "meetingDate" | "createdAt", sortOrder: "asc" | "desc") => {
      setParams((prev) => ({ ...prev, sortBy, sortOrder }));
    },
    []
  );

  return {
    meetings: data?.meetings ?? ([] as PortalMeetingWithArtifacts[]),
    total: data?.total ?? 0,
    page: data?.page ?? 1,
    pageSize: data?.pageSize ?? 10,
    isLoading,
    error,
    mutate,
    createMeeting,
    updateMeeting,
    deleteMeeting,
    toggleVisibility,
    setPage,
    setPageSize,
    setSorting,
  } as const;
}
