import { useEffect, useRef } from "react";
import { useAnnouncements } from "@/contexts/AnnouncementContext";
import { SLOW_NETWORK_TEXT } from "@/types/announcement";

type UploadFailureEvent = CustomEvent<{
  transcriptId: number;
  partNumber?: number;
  error: string;
}>;

const ANNOUNCEMENT_DEBOUNCE_MS = 10000;

export function useUploadFailureAnnouncements() {
  const { addAnnouncement } = useAnnouncements();
  const lastAnnouncementTimeRef = useRef<number>(0);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleUploadFailure = (event: Event) => {
      const customEvent = event as UploadFailureEvent;
      const now = Date.now();
      const timeSinceLastAnnouncement = now - lastAnnouncementTimeRef.current;

      if (timeSinceLastAnnouncement < ANNOUNCEMENT_DEBOUNCE_MS) {
        return;
      }

      addAnnouncement({
        text: SLOW_NETWORK_TEXT,
        variant: "slow-network",
        dismissible: true,
        transcriptId: customEvent.detail.transcriptId,
      });

      lastAnnouncementTimeRef.current = now;
    };

    window.addEventListener("upload-chunk-failure", handleUploadFailure);

    return () => {
      window.removeEventListener("upload-chunk-failure", handleUploadFailure);
    };
  }, [addAnnouncement]);
}
