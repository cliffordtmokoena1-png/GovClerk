import useSWR from "swr";
import { useOrgContext } from "@/contexts/OrgContext";
import type { PortalMeeting, PortalMeetingResponse } from "@/types/portal";

const fetcher = async (url: string): Promise<PortalMeetingResponse> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to fetch meeting");
  }
  return response.json();
};

export function useMeeting(meetingId: string | undefined) {
  const { orgId } = useOrgContext();

  const url = meetingId && orgId ? `/api/portal/meetings/${meetingId}?orgId=${orgId}` : null;

  const { data, error, isLoading, mutate } = useSWR<PortalMeetingResponse>(url, fetcher, {
    revalidateOnFocus: false,
  });

  return {
    meeting: data?.meeting as PortalMeeting | undefined,
    isLoading,
    error,
    mutate,
  } as const;
}
