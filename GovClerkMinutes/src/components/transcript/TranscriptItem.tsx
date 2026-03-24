import { Box } from "@chakra-ui/react";
import type { VirtualItem } from "@tanstack/react-virtual";
import TranscriptSegment from "@/components/TranscriptSegment";
import type { TranscriptApiData } from "@/types/types";
import type { Speaker } from "@/lib/speakerLabeler";
import type { RefObject } from "react";
import type H5AudioPlayer from "react-h5-audio-player";

export type TranscriptItemProps = {
  virtualItem: VirtualItem;
  measureElement: (element: Element | null) => void;
  segment: TranscriptApiData["segments"][number];
  isActive: boolean;
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
  segmentIndex: number;
};

export function TranscriptItem({
  virtualItem,
  measureElement,
  segment,
  isActive,
  isMobile,
  labelsToSpeaker,
  knownSpeakers,
  transcriptId,
  audioPlayerRef,
  triggerSpeakerLabel,
  onOpenRelabelModal,
  onMenuStateChange,
  onBeforeMenuOpen,
  segmentIndex,
}: TranscriptItemProps) {
  return (
    <Box
      data-index={virtualItem.index}
      ref={measureElement}
      position="absolute"
      top={0}
      left={0}
      w="full"
      transform={`translateY(${virtualItem.start}px)`}
      style={{ willChange: "transform" }}
    >
      <TranscriptSegment
        segment={segment}
        isActive={isActive}
        onMenuStateChange={onMenuStateChange}
        onBeforeMenuOpen={onBeforeMenuOpen}
        isMobile={isMobile}
        labelsToSpeaker={labelsToSpeaker}
        knownSpeakers={knownSpeakers}
        transcriptId={transcriptId}
        audioPlayerRef={audioPlayerRef}
        triggerSpeakerLabel={triggerSpeakerLabel}
        onOpenRelabelModal={onOpenRelabelModal}
        segmentIndex={segmentIndex}
      />
    </Box>
  );
}
