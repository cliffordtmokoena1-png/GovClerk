import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useSWRConfig } from "swr";
import { useToast } from "@chakra-ui/react";
import {
  MinutesState,
  beginFeedbackStreaming,
  stopStreaming,
  isRegenerationInProgress,
} from "@/types/MinutesState";
import { safeCapture } from "@/utils/safePosthog";
import { serverUri } from "@/utils/server";
import { useOrgContext } from "@/contexts/OrgContext";

type UseRegenerateAgendaProps = {
  seriesId: string;
  setMinutesManager: React.Dispatch<React.SetStateAction<MinutesState>>;
  onSuccess?: () => void;
};

export const useRegenerateAgenda = ({
  seriesId,
  setMinutesManager,
  onSuccess,
}: UseRegenerateAgendaProps) => {
  const [isRegenerating, setIsRegenerating] = useState(false);
  const { getToken } = useAuth();
  const { mutate } = useSWRConfig();
  const toast = useToast();
  const { orgId } = useOrgContext();

  const regenerateAgenda = async (feedback: string) => {
    if (!feedback.trim() || isRegenerating) {
      return;
    }

    setIsRegenerating(true);

    // Immediately create new tab and switch to it
    setMinutesManager((prev) => {
      // Don't start new regeneration if already streaming
      if (isRegenerationInProgress(prev)) {
        return prev;
      }
      return beginFeedbackStreaming(prev);
    });

    try {
      const token = await getToken();

      const response = await fetch(serverUri("/api/regenerate-agenda"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          series_id: seriesId,
          feedback,
          org_id: orgId,
        }),
      });

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error("Regeneration limit exceeded.");
        }
        throw new Error(`Failed to regenerate agenda: ${response.status}`);
      }

      // Wait for the response to complete
      await response.json();

      // Refresh agenda data and stop streaming state
      await mutate(["/api/agendas/by-series", seriesId], undefined, { revalidate: true });

      setMinutesManager((prev) => stopStreaming(prev));

      safeCapture("agenda_feedback_sent", {
        series_id: seriesId,
        feedback,
      });

      onSuccess?.();
    } catch (error) {
      console.error("Error regenerating agenda:", error);

      toast({
        title: "Failed to regenerate agenda",
        description:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred. Please try again.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });

      // Stop streaming state on error
      setMinutesManager((prev) => stopStreaming(prev));
    } finally {
      setIsRegenerating(false);
    }
  };

  return {
    regenerateAgenda,
    isRegenerating,
  };
};
