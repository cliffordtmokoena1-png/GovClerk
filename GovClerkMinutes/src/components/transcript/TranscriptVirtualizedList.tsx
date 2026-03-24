import { Box } from "@chakra-ui/react";
import type { Virtualizer, VirtualItem } from "@tanstack/react-virtual";
import type { TranscriptApiData } from "@/types/types";
import type { Speaker } from "@/lib/speakerLabeler";
import type { RefObject } from "react";
import type H5AudioPlayer from "react-h5-audio-player";
import { TranscriptItem } from "@/components/transcript/TranscriptItem";

export type TranscriptVirtualizedListProps = {
  virtualizer: Virtualizer<HTMLDivElement, Element>;
  virtualItems: VirtualItem[];
  totalSize: number;
  filteredIndices: number[];
  getSegmentData: (index: number) => TranscriptApiData["segments"][number] | undefined;
  activeSegmentIndex: number | null;
  isMobile: boolean;
  labelsToSpeaker: Record<string, Speaker>;
  knownSpeakers: string[];
  transcriptId: number;
  audioPlayerRef: RefObject<H5AudioPlayer | null>;
  triggerSpeakerLabel: (speaker: Speaker, selectedLabel: string) => void;
  onOpenRelabelModal: (
    currentSpeakerLabel: string,
    segmentStart: string,
    segmentStop: string
  ) => void;
  onMenuStateChange: (segmentKey: string, isOpen: boolean) => void;
  onBeforeMenuOpen: (segmentKey: string, buttonElement?: HTMLElement) => Promise<void> | void;
};

export function TranscriptVirtualizedList({
  virtualizer,
  virtualItems,
  totalSize,
  filteredIndices,
  getSegmentData,
  activeSegmentIndex,
  isMobile,
  labelsToSpeaker,
  knownSpeakers,
  transcriptId,
  audioPlayerRef,
  triggerSpeakerLabel,
  onOpenRelabelModal,
  onMenuStateChange,
  onBeforeMenuOpen,
}: TranscriptVirtualizedListProps) {
  return (
    <Box h={totalSize} w="full" position="relative">
      {virtualItems.map((virtualItem) => {
        const actualIndex = filteredIndices[virtualItem.index];
        const segment = getSegmentData(actualIndex);

        if (!segment) {
          return null;
        }

        return (
          <TranscriptItem
            key={virtualItem.key}
            virtualItem={virtualItem}
            measureElement={virtualizer.measureElement}
            segment={segment}
            isActive={virtualItem.index === activeSegmentIndex}
            isMobile={isMobile}
            labelsToSpeaker={labelsToSpeaker}
            knownSpeakers={knownSpeakers}
            transcriptId={transcriptId}
            audioPlayerRef={audioPlayerRef}
            triggerSpeakerLabel={triggerSpeakerLabel}
            onOpenRelabelModal={onOpenRelabelModal}
            onMenuStateChange={onMenuStateChange}
            onBeforeMenuOpen={onBeforeMenuOpen}
            segmentIndex={actualIndex}
          />
        );
      })}
    </Box>
  );
}
