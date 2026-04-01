import React from "react";
import H5AudioPlayer from "react-h5-audio-player";
import AudioPlayer from "../AudioPlayer";
import MobileTabbedView from "./MobileTabbedView";
import { AUDIO_PLAYER_HEIGHT } from "@/constants/layout";

type Props = {
  transcriptId: number;
  transcriptTitle: string;
  audioSrc: string | null | undefined;
  audioPlayerRef: React.RefObject<H5AudioPlayer | null>;
  uploadComplete: boolean;
  transcribeFinished: boolean;
  minutesReady: boolean;
  onDuration: (duration: number | undefined) => void;
  onAudioLoadError: (error: Event) => void;
  transcriptContent: React.ReactNode;
  speakersContent: React.ReactNode;
  minutesContent: React.ReactNode;
  minutesVersions?: number;
  selectedMinutesVersion?: number;
  onMinutesVersionChange?: (version: number) => void;
  isRegenerating?: boolean;
  onExport: () => void;
  onMoreActions: () => void;
  onRetrieve?: () => void;
};

export default function MobileTranscriptMinutesView({
  transcriptId,
  transcriptTitle,
  audioSrc,
  audioPlayerRef,
  uploadComplete,
  transcribeFinished,
  minutesReady,
  onDuration,
  onAudioLoadError,
  transcriptContent,
  speakersContent,
  minutesContent,
  minutesVersions = 1,
  selectedMinutesVersion = 0,
  onMinutesVersionChange,
  isRegenerating = false,
  onExport,
  onMoreActions,
  onRetrieve,
}: Props) {
  const tabs = [
    { label: "Speakers", content: speakersContent },
    { label: "Transcript", content: transcriptContent },
  ];

  const audioPlayer = audioSrc ? (
    <AudioPlayer
      audioSrc={audioSrc}
      audioPlayerRef={audioPlayerRef}
      onDuration={onDuration}
      onAudioLoadError={onAudioLoadError}
    />
  ) : undefined;

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
      uploadComplete={uploadComplete}
      transcribeFinished={transcribeFinished}
      minutesReady={minutesReady}
      onExport={onExport}
      onMoreActions={onMoreActions}
      onRetrieve={onRetrieve}
      audioPlayer={audioPlayer}
      audioPlayerHeight={AUDIO_PLAYER_HEIGHT}
    />
  );
}
