import { useState, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { serverUri } from "@/utils/server";
import { isDev } from "@/utils/dev";

interface UseMinutesRegenerateOptions {
  transcriptId: number | null;
  currentVersionCount: number;
  orgId: string | null;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

interface UseMinutesRegenerateReturn {
  regenerate: (feedback: string) => Promise<void>;
  isRegenerating: boolean;
  canRegenerate: boolean; // false if >= 3 versions
  error: Error | null;
}

export function useMinutesRegenerate(
  options: UseMinutesRegenerateOptions
): UseMinutesRegenerateReturn {
  const { transcriptId, currentVersionCount, orgId, onSuccess, onError } = options;
  const { getToken } = useAuth();

  const [isRegenerating, setIsRegenerating] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const canRegenerate = currentVersionCount < 3;

  const regenerate = useCallback(
    async (feedback: string) => {
      if (!transcriptId || !feedback.trim() || isRegenerating || !canRegenerate) {
        return;
      }

      setIsRegenerating(true);
      setError(null);

      try {
        const token = await getToken();

        const requestBody = {
          transcript_id: transcriptId,
          feedback,
          test_mode: isDev(),
          org_id: orgId,
        };

        const response = await fetch(serverUri("/api/regenerate-minutes"), {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const responseText = await response.text();
          console.error("[useMinutesRegenerate] error response:", response.status, responseText);
          if (response.status === 403) {
            throw new Error("Regeneration limit exceeded");
          }
          throw new Error(`Failed to regenerate minutes: ${response.status}`);
        }

        onSuccess?.();
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Regeneration failed");
        setError(error);
        onError?.(error);
      } finally {
        setIsRegenerating(false);
      }
    },
    [transcriptId, onSuccess, onError, canRegenerate, isRegenerating, getToken, orgId]
  );

  return {
    regenerate,
    isRegenerating,
    canRegenerate,
    error,
  };
}
