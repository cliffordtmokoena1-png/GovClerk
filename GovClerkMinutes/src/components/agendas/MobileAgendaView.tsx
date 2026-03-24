import React from "react";
import MobileTabbedView from "../mobile/MobileTabbedView";

type Props = Readonly<{
  agendaId: number;
  agendaTitle: string;
  sourceContent: React.ReactNode;
  agendaContent: React.ReactNode;
  agendaVersions?: number;
  selectedAgendaVersion?: number;
  onAgendaVersionChange?: (version: number) => void;
  isRegenerating?: boolean;
  onExport: () => void;
  onMoreActions: () => void;
  agendaReady?: boolean;
}>;

export default function MobileAgendaView({
  agendaId,
  agendaTitle,
  sourceContent,
  agendaContent,
  agendaVersions = 1,
  selectedAgendaVersion = 0,
  onAgendaVersionChange,
  isRegenerating = false,
  onExport,
  onMoreActions,
  agendaReady = true,
}: Props) {
  const tabs = [{ label: "Source", content: sourceContent }];

  return (
    <MobileTabbedView
      transcriptId={agendaId}
      transcriptTitle={agendaTitle}
      tabs={tabs}
      minutesContent={agendaContent}
      minutesVersions={agendaVersions}
      selectedMinutesVersion={selectedAgendaVersion}
      onMinutesVersionChange={onAgendaVersionChange}
      isRegenerating={isRegenerating}
      minutesReady={agendaReady}
      onExport={onExport}
      onMoreActions={onMoreActions}
      contentType="Agenda"
    />
  );
}
