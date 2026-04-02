import useSWR from "swr";
import { useCallback } from "react";
import { useOrgContext } from "@/contexts/OrgContext";
import { getSophonHttpUrl } from "@/sophon/config";
import type {
  BroadcastWithMeeting,
  ActiveBroadcastResponse,
  BroadcastResponse,
  CreateBroadcastRequest,
  UpdateBroadcastRequest,
} from "@/types/broadcast";

const fetcher = async (url: string): Promise<ActiveBroadcastResponse> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to fetch broadcast");
  }
  return response.json();
};

function buildSwrKey(orgId: string | null, meetingId?: number): string | null {
  if (!orgId) {
    return null;
  }
  const baseUrl = `/api/broadcast?orgId=${orgId}`;
  return meetingId ? `${baseUrl}&meetingId=${meetingId}` : baseUrl;
}

async function sendTranscriptMarker(
  streamKey: string,
  markerType: "go_live" | "pause" | "resume" | "end"
): Promise<void> {
  try {
    const response = await fetch(getSophonHttpUrl("/transcribe/marker"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ streamKey, markerType }),
    });
    if (!response.ok) {
      console.warn(`Failed to send ${markerType} marker:`, await response.text());
    }
  } catch (err) {
    console.warn(`Failed to send ${markerType} marker:`, err);
  }
}

export function useBroadcast(meetingId?: number) {
  const { orgId } = useOrgContext();

  const url = buildSwrKey(orgId, meetingId);

  const { data, error, isLoading, mutate } = useSWR<ActiveBroadcastResponse>(url, fetcher, {
    revalidateOnFocus: true,
    refreshInterval: 5000,
  });

  const checkExistingSegments = useCallback(
    async (
      mgMeetingId: number
    ): Promise<{ hasExistingSegments: boolean; segmentCount: number }> => {
      const response = await fetch(
        `/api/broadcast/check-segments?orgId=${orgId}&meetingId=${mgMeetingId}`
      );

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Failed to check segments");
        throw new Error(errorText || "Failed to check existing broadcast segments");
      }

      return response.json();
    },
    [orgId]
  );

  const startBroadcast = useCallback(
    async (mgMeetingId: number): Promise<BroadcastWithMeeting> => {
      const response = await fetch("/api/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, mgMeetingId } as CreateBroadcastRequest & { orgId: string }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to start broadcast");
      }

      const result: BroadcastResponse = await response.json();
      mutate();
      return result.broadcast;
    },
    [orgId, mutate]
  );

  const updateBroadcast = useCallback(
    async (broadcastId: number, updates: UpdateBroadcastRequest): Promise<BroadcastWithMeeting> => {
      const response = await fetch(`/api/broadcast/${broadcastId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, ...updates }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update broadcast");
      }

      const result: BroadcastResponse = await response.json();
      await mutate(
        (currentData) => {
          return currentData
            ? {
                ...currentData,
                broadcast: result.broadcast,
              }
            : currentData;
        },
        { revalidate: false }
      );
      return result.broadcast;
    },
    [orgId, mutate]
  );

  const endBroadcast = useCallback(
    async (broadcastId: number, streamKey?: string): Promise<void> => {
      const response = await fetch(`/api/broadcast/${broadcastId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to end broadcast");
      }

      if (streamKey) {
        await sendTranscriptMarker(streamKey, "end");
      }

      mutate();
    },
    [orgId, mutate]
  );

  const deleteBroadcast = useCallback(
    async (broadcastId: number): Promise<void> => {
      const response = await fetch(`/api/broadcast/${broadcastId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete broadcast");
      }

      // No transcript marker needed for canceling setup
      mutate();
    },
    [orgId, mutate]
  );

  const goLive = useCallback(
    async (broadcastId: number, streamKey?: string): Promise<BroadcastWithMeeting> => {
      const response = await fetch(`/api/broadcast/${broadcastId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, status: "live" }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to go live");
      }

      const result: BroadcastResponse = await response.json();
      await mutate(
        (currentData) =>
          currentData ? { ...currentData, broadcast: result.broadcast } : currentData,
        { revalidate: false }
      );

      if (streamKey) {
        await sendTranscriptMarker(streamKey, "go_live");
      }
      return result.broadcast;
    },
    [orgId, mutate]
  );

  const pauseBroadcast = useCallback(
    async (broadcastId: number, streamKey?: string): Promise<BroadcastWithMeeting> => {
      const result = await updateBroadcast(broadcastId, { status: "paused" });
      if (streamKey) {
        await sendTranscriptMarker(streamKey, "pause");
      }
      return result;
    },
    [updateBroadcast]
  );

  const resumeBroadcast = useCallback(
    async (broadcastId: number, streamKey?: string): Promise<BroadcastWithMeeting> => {
      const result = await updateBroadcast(broadcastId, { status: "live" });
      if (streamKey) {
        await sendTranscriptMarker(streamKey, "resume");
      }
      return result;
    },
    [updateBroadcast]
  );

  const setCurrentAgendaItem = useCallback(
    async (
      broadcastId: number,
      agendaItemId: number | null,
      recordingPositionMs?: number
    ): Promise<BroadcastWithMeeting> => {
      const result = await updateBroadcast(broadcastId, {
        currentAgendaItemId: agendaItemId,
        recordingPositionMs,
      });

      try {
        await fetch(`/api/broadcast/${broadcastId}/notify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "broadcast_update",
            currentAgendaItemId: agendaItemId,
            status: result.status,
            orgId,
          }),
        });
      } catch (err) {
        console.warn("Failed to notify broadcast update:", err);
      }

      return result;
    },
    [updateBroadcast]
  );

  const updateNotes = useCallback(
    async (broadcastId: number, notes: string): Promise<BroadcastWithMeeting> => {
      return updateBroadcast(broadcastId, { notes });
    },
    [updateBroadcast]
  );

  return {
    broadcast: data?.broadcast ?? null,
    isOwner: data?.isOwner ?? false,
    ownerName: data?.ownerName,
    isLoading,
    error,
    mutate,
    checkExistingSegments,
    startBroadcast,
    updateBroadcast,
    endBroadcast,
    deleteBroadcast,
    goLive,
    pauseBroadcast,
    resumeBroadcast,
    setCurrentAgendaItem,
    updateNotes,
  };
}
