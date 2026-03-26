import { useState, useCallback } from "react";
import { useRouter } from "next/router";
import posthog from "posthog-js";
import { safeCapture } from "@/utils/safePosthog";
import { useOrgContext } from "@/contexts/OrgContext";
import { LayoutKind } from "@/pages/dashboard/[[...slug]]";

type UseRecordingSessionCreatorParams = {
  layoutKind: LayoutKind;
};

type UseRecordingSessionCreatorResult = {
  createSessionAndNavigate: () => Promise<void>;
  isCreating: boolean;
  error: string | null;
  clearError: () => void;
};

export default function useRecordingSessionCreator({
  layoutKind,
}: UseRecordingSessionCreatorParams): UseRecordingSessionCreatorResult {
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { orgId } = useOrgContext();
  const router = useRouter();

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const createSessionAndNavigate = useCallback(async () => {
    setIsCreating(true);
    setError(null);

    try {
      const region = "us-east-1";

      const now = new Date();
      const dateStr = now.toLocaleDateString();
      const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const title = `GC Recording (${dateStr} ${timeStr}).webm`;

      const createIdResponse = await fetch("/api/create-id", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          fileSize: 0,
          region,
          uploadKind: "audio",
          isRecording: true,
          orgId,
        }),
      });

      if (!createIdResponse.ok) {
        throw new Error("Failed to create transcript");
      }

      const { transcriptId } = await createIdResponse.json();

      await router.push(`/dashboard/${transcriptId}`, undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));

      safeCapture("recording_error", {
        error_type: "session_creation_failed",
        error_name: err instanceof Error ? err.name : "Unknown",
        error_message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsCreating(false);
    }
  }, [router, orgId]);

  return {
    createSessionAndNavigate,
    isCreating,
    error,
    clearError,
  };
}
