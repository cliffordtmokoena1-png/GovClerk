import React from "react";
import MobileTabbedView from "./MobileTabbedView";

type Props = {
  transcriptId: number;
  transcriptTitle: string;
  referenceContent: React.ReactNode;
  minutesContent: React.ReactNode;
  minutesVersions?: number;
  selectedMinutesVersion?: number;
  onMinutesVersionChange?: (version: number) => void;
  isRegenerating?: boolean;
  onExport: () => void;
  onMoreActions: () => void;
};

export default function MobileTextTranscriptView({
  transcriptId,
  transcriptTitle,
  referenceContent,
  minutesContent,
  minutesVersions = 1,
  selectedMinutesVersion = 0,
  onMinutesVersionChange,
  isRegenerating = false,
  onExport,
  onMoreActions,
}: Props) {
  const tabs = [{ label: "Upload", content: referenceContent }];

  return (
    <MobileTabbedView
      transcriptId={transcriptId}
      transcriptTitle={transcriptTitle}
      tabs={tabs}
      minutesContent={minutesContent}
      minutesVersions={minutesVersions}
      selectedMinutesVersion={selectedMinutesVersion}
      onMinutesVersionChange={onMinutesVersionChange}
      isRegenerating={isRegenerating}
      onExport={onExport}
      onMoreActions={onMoreActions}
    />
  );
}
