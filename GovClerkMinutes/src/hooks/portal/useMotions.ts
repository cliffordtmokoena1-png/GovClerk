import { useCallback } from "react";
import { toast } from "sonner";
import useSWR, { mutate as globalMutate } from "swr";

import type {
  MgMotion,
  CreateMotionInput,
  UpdateMotionInput,
  MotionWithVotes,
} from "@/types/agenda";
import { useOrgContext } from "@/contexts/OrgContext";

interface MotionsResponse {
  motions: MgMotion[];
}

interface MotionResponse {
  motion: MotionWithVotes;
}

const fetcher = async (url: string): Promise<MotionsResponse> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to fetch motions");
  }
  return response.json();
};

export function useMotions(meetingId: number | null, agendaItemId: number | null) {
  const { orgId } = useOrgContext();

  const url =
    meetingId && agendaItemId && orgId
      ? `/api/portal/meetings/${meetingId}/agenda-items/${agendaItemId}/motions?orgId=${orgId}`
      : null;

  const { data, error, isLoading, mutate } = useSWR<MotionsResponse>(url, fetcher, {
    revalidateOnFocus: false,
  });

  const createMotion = useCallback(
    async (
      input: Omit<CreateMotionInput, "org_id" | "agenda_item_id" | "ordinal"> & {
        agenda_item_id?: number;
        ordinal?: number;
      }
    ): Promise<MotionWithVotes> => {
      if (!meetingId) {
        throw new Error("Meeting ID is required");
      }
      if (!agendaItemId && !input.agenda_item_id) {
        throw new Error("Agenda Item ID is required");
      }

      const finalAgendaItemId = agendaItemId || input.agenda_item_id!;

      // Get max ordinal for this agenda item
      const motionsUrl = `/api/portal/meetings/${meetingId}/agenda-items/${finalAgendaItemId}/motions?orgId=${orgId}`;
      const motionsData = await globalMutate(motionsUrl).then(
        (res: MotionsResponse | undefined) => res
      );
      const maxOrdinal = motionsData?.motions?.length || 0;

      const response = await fetch(motionsUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...input,
          orgId,
          agenda_item_id: finalAgendaItemId,
          ordinal: input.ordinal ?? maxOrdinal + 1,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message = errorData.error || "Failed to create motion";
        toast.error(message);
        throw new Error(message);
      }

      const result: MotionResponse = await response.json();
      await mutate();
      toast.success("Motion created");
      return result.motion;
    },
    [meetingId, agendaItemId, orgId, mutate]
  );

  const updateMotion = useCallback(
    async (
      motionId: number,
      input: UpdateMotionInput,
      targetAgendaItemId?: number
    ): Promise<MotionWithVotes> => {
      if (!meetingId) {
        throw new Error("Meeting ID is required");
      }
      if (!agendaItemId && !targetAgendaItemId) {
        throw new Error("Agenda Item ID is required");
      }

      const finalAgendaItemId = agendaItemId || targetAgendaItemId!;

      const response = await fetch(
        `/api/portal/meetings/${meetingId}/agenda-items/${finalAgendaItemId}/motions/${motionId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...input, orgId }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message = errorData.error || "Failed to update motion";
        toast.error(message);
        throw new Error(message);
      }

      const result: MotionResponse = await response.json();
      await mutate();
      toast.success("Motion updated");
      return result.motion;
    },
    [meetingId, agendaItemId, orgId, mutate]
  );

  const deleteMotion = useCallback(
    async (motionId: number, targetAgendaItemId?: number): Promise<void> => {
      if (!meetingId) {
        throw new Error("Meeting ID is required");
      }
      if (!agendaItemId && !targetAgendaItemId) {
        throw new Error("Agenda Item ID is required");
      }

      const finalAgendaItemId = agendaItemId || targetAgendaItemId!;

      const response = await fetch(
        `/api/portal/meetings/${meetingId}/agenda-items/${finalAgendaItemId}/motions/${motionId}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orgId }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message = errorData.error || "Failed to delete motion";
        toast.error(message);
        throw new Error(message);
      }

      await mutate();
      toast.success("Motion deleted");
    },
    [meetingId, agendaItemId, orgId, mutate]
  );

  const reorderMotions = useCallback(
    async (
      reorderData: Array<{ id: number; ordinal: number }>,
      targetAgendaItemId?: number
    ): Promise<void> => {
      if (!meetingId) {
        throw new Error("Meeting ID is required");
      }
      if (!agendaItemId && !targetAgendaItemId) {
        throw new Error("Agenda Item ID is required");
      }

      const finalAgendaItemId = agendaItemId || targetAgendaItemId!;

      // Update each motion individually
      await Promise.all(
        reorderData.map(({ id, ordinal }) =>
          fetch(
            `/api/portal/meetings/${meetingId}/agenda-items/${finalAgendaItemId}/motions/${id}`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ordinal, orgId }),
            }
          )
        )
      );

      await mutate();
      toast.success("Motions reordered");
    },
    [meetingId, agendaItemId, orgId, mutate]
  );

  return {
    motions: data?.motions ?? [],
    isLoading,
    error,
    mutate,
    createMotion,
    updateMotion,
    deleteMotion,
    reorderMotions,
  } as const;
}
