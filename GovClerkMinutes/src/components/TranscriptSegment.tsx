import { Flex, Text, Box, Circle, HStack } from "@chakra-ui/react";
import { memo, useCallback } from "react";
import { colorFromString } from "@/utils/color";
import { formatTimestamp, timestampToSeconds } from "@/utils/time";
import SpeakerLabelerButton from "./SpeakerLabelerButton";
import { Speaker } from "@/lib/speakerLabeler";
import H5AudioPlayer from "react-h5-audio-player";
import type { TranscriptApiData } from "@/types/types";

export const TRANSCRIPT_MIN_HEIGHT_PX = 24;

type SegmentProps = {
  segment: TranscriptApiData["segments"][number];
  labelsToSpeaker: { [key: string]: Speaker };
  knownSpeakers: string[];
  triggerSpeakerLabel: (speaker: Speaker, selectedLabel: string) => void;
  audioPlayerRef: React.RefObject<H5AudioPlayer | null>;
  isActive?: boolean;
  isMobile: boolean;
  onMenuStateChange: (segmentKey: string, isOpen: boolean) => void;
  onBeforeMenuOpen?: (segmentKey: string) => Promise<void> | void;
  onOpenRelabelModal?: (
    currentSpeakerLabel: string,
    segmentStart: string,
    segmentStop: string
  ) => void;
  transcriptId?: number;
  segmentIndex: number;
};

const TranscriptSegment = memo(function TranscriptSegment({
  segment,
  labelsToSpeaker,
  knownSpeakers,
  triggerSpeakerLabel,
  audioPlayerRef,
  isActive = false,
  isMobile,
  onMenuStateChange,
  onBeforeMenuOpen,
  onOpenRelabelModal,
  transcriptId,
  segmentIndex,
}: SegmentProps) {
  const speakerLabel = segment.speaker;
  const isAnimating = segment.transcript === null;
  const speakerInfo = labelsToSpeaker[speakerLabel];
  const speakerColor =
    speakerInfo?.uses > 0 ? colorFromString(speakerInfo.name || segment.speaker) : "#94A3B8";

  const speakerName = speakerInfo?.name || speakerLabel;
  const speakerInitial = speakerName.charAt(0).toUpperCase();

  const handleJumpToTime = useCallback(() => {
    const audioEl = audioPlayerRef.current?.audio.current;
    if (audioEl != null) {
      audioEl.currentTime = timestampToSeconds(segment.start);
    }
  }, [audioPlayerRef, segment.start]);

  const handleOpenRelabelModal = useCallback(() => {
    if (onOpenRelabelModal) {
      onOpenRelabelModal(segment.speaker, segment.start, segment.stop);
    }
  }, [onOpenRelabelModal, segment.speaker, segment.start, segment.stop]);

  return segment.transcript === "" ? null : (
    <Flex
      position="relative"
      mb={6}
      align="flex-start"
      gap={4}
      opacity={isActive ? 1 : 0.8}
      transition="all 0.3s ease"
      cursor="pointer"
      onClick={handleJumpToTime}
      _hover={{ opacity: 1 }}
      pl={4}
      role="group"
    >
      <Box position="relative" zIndex={1}>
        <Circle
          size="28px"
          bg={speakerColor}
          color="white"
          fontWeight="bold"
          fontSize="xs"
          border={isActive ? "2px solid" : "1px solid"}
          borderColor={isActive ? "blue.400" : "white"}
          shadow={isActive ? "md" : "sm"}
          transition="all 0.3s ease"
          transform="scale(1)"
          _groupHover={{ transform: "scale(1.05)" }}
        >
          {speakerInitial}
        </Circle>
      </Box>

      <Box flex={1} pt={0}>
        <HStack spacing={3} mb={1}>
          <SpeakerLabelerButton
            labelsToSpeaker={labelsToSpeaker}
            selectedLabel={speakerLabel}
            variant="text"
            isDisabled={false}
            segmentKey={segmentIndex.toString()}
            onMenuStateChange={onMenuStateChange}
            onBeforeMenuOpen={onBeforeMenuOpen}
          />
          {!isMobile && (
            <>
              <Text
                fontSize="xs"
                color="gray.500"
                fontWeight="medium"
                transition="all 0.2s ease"
                _groupHover={{ display: "none" }}
              >
                {formatTimestamp(segment.start)}
              </Text>
              <Text
                fontSize="xs"
                color="blue.600"
                fontWeight="medium"
                transition="all 0.2s ease"
                display="none"
                _groupHover={{ display: "inline" }}
              >
                {formatTimestamp(segment.start)}
              </Text>
            </>
          )}
          {isMobile && (
            <Text fontSize="xs" color="gray.500" fontWeight="medium">
              {formatTimestamp(segment.start)}
            </Text>
          )}
        </HStack>

        <Text
          fontSize="sm"
          lineHeight="1.5"
          color={isActive ? "gray.900" : "gray.700"}
          fontWeight={isActive ? "medium" : "normal"}
          minH={`${TRANSCRIPT_MIN_HEIGHT_PX}px`}
          sx={
            isAnimating
              ? {
                  background: "linear-gradient(90deg, gray.400 25%, gray.700 50%, gray.400 75%)",
                  backgroundClip: "text",
                  color: "transparent",
                  animation: "gradient-animation 2s linear infinite",
                  backgroundSize: "200% 100%",
                }
              : {}
          }
        >
          {segment.transcript === null
            ? `Transcribing segment - ${formatTimestamp(segment.start)}`
            : segment.transcript}
        </Text>
      </Box>
    </Flex>
  );
});

export default TranscriptSegment;
