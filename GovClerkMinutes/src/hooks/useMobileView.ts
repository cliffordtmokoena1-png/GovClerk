import { useEffect, useState, useRef } from "react";

export type MobileView =
  | "home"
  | "recordings"
  | "new-meeting"
  | "templates"
  | "account"
  | "dashboard-transcript"
  | "dashboard-minutes"
  | "past-meetings";

export default function useMobileView(
  transcriptId: number | null | undefined
): [MobileView, (view: MobileView) => void] {
  const getInitialView = (): MobileView => {
    return transcriptId == null ? "new-meeting" : "dashboard-minutes";
  };

  const [mobileView, setMobileView] = useState<MobileView>(getInitialView);
  const prevTranscriptIdRef = useRef<number | undefined>(transcriptId);

  useEffect(() => {
    const prevTranscriptId = prevTranscriptIdRef.current;
    const hasTranscriptIdChanged = prevTranscriptId !== transcriptId;

    prevTranscriptIdRef.current = transcriptId;

    if (!hasTranscriptIdChanged) {
      return;
    }

    if (transcriptId == null) {
      if (
        mobileView !== "home" &&
        mobileView !== "recordings" &&
        mobileView !== "templates" &&
        mobileView !== "account" &&
        mobileView !== "new-meeting"
      ) {
        setMobileView("home");
      }
    } else {
      if (
        mobileView === "home" ||
        mobileView === "recordings" ||
        mobileView === "templates" ||
        mobileView === "account" ||
        mobileView === "new-meeting" ||
        mobileView === "past-meetings"
      ) {
        setMobileView("dashboard-transcript");
      }
    }
  }, [transcriptId, mobileView]);

  return [mobileView, setMobileView];
}
