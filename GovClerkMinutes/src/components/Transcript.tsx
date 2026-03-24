import { Flex, Text, Box, Circle, HStack, useBreakpointValue } from "@chakra-ui/react";
import { useEffect, useState, useRef, useCallback } from "react";
import type {
  WheelEvent as ReactWheelEvent,
  TouchEvent as ReactTouchEvent,
  ReactNode,
  RefObject,
} from "react";
import { menuStateManager } from "@/utils/menuState";
import { MobileSpeakerLabelerDrawer } from "./MobileSpeakerLabelerDrawer";
import { DesktopSpeakerLabelerPopover } from "./DesktopSpeakerLabelerPopover";
import { TranscriptApiData } from "@/types/types";
import { Speaker } from "@/lib/speakerLabeler";
import H5AudioPlayer from "react-h5-audio-player";
import { useTranscriptVirtualization } from "@/hooks/useTranscriptVirtualization";
import { TranscriptScrollManager } from "@/components/transcript/TranscriptScrollManager";
import { TranscriptVirtualizedList } from "@/components/transcript/TranscriptVirtualizedList";

type TranscriptProps = {
  transcript: TranscriptApiData;
  labelsToSpeaker: { [key: string]: Speaker };
  knownSpeakers: string[];
  transcriptId: number;
  audioPlayerRef: RefObject<H5AudioPlayer | null>;
  filteredSpeaker?: Speaker;
  triggerSpeakerLabel: (speaker: Speaker, selectedLabel: string) => void;
  onOpenRelabelModal: (
    currentSpeakerLabel: string,
    segmentStart: string,
    segmentStop: string
  ) => void;
  bottomSpacing?: number; // Custom bottom spacing for mobile tabbed view
};

const Transcript = ({
  transcript,
  labelsToSpeaker,
  knownSpeakers,
  transcriptId,
  audioPlayerRef,
  filteredSpeaker,
  triggerSpeakerLabel,
  onOpenRelabelModal,
  bottomSpacing = 20,
}: TranscriptProps) => {
  const [activeSegmentIndex, setActiveSegmentIndex] = useState<number | null>(null);
  const [buttonPosition, setButtonPosition] = useState<{ top: number; left: number } | null>(null);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [isScrollLocked, setIsScrollLocked] = useState(false);
  const [activeDrawerSegmentKey, setActiveDrawerSegmentKey] = useState<string | null>(null);

  const isMobile = useBreakpointValue({ base: true, md: false }) ?? false;

  // Track if any speaker labeler menu is open for autoscroll prevention and scroll locking
  const isAnyMenuOpenRef = useRef<boolean>(false);
  const openMenuKeysRef = useRef<Set<string>>(new Set());
  const scrollLockPositionRef = useRef<number>(0);
  const suppressScrollEventRef = useRef<boolean>(false);

  const parentRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastScrollToIndexRef = useRef<number | null>(null);

  const { filteredIndices, getSegmentData, findActiveSegmentIndex, virtualizer } =
    useTranscriptVirtualization({
      segments: transcript.segments,
      labelsToSpeaker,
      filteredSpeaker,
      parentRef,
    });

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  const handleScroll = useCallback(() => {
    if (suppressScrollEventRef.current) {
      suppressScrollEventRef.current = false;
      return;
    }

    const scrollContainer = parentRef.current;
    if (!scrollContainer) {
      return;
    }

    if (openMenuKeysRef.current.size > 0) {
      const lockedScrollTop = scrollLockPositionRef.current;
      if (scrollContainer.scrollTop !== lockedScrollTop) {
        suppressScrollEventRef.current = true;
        scrollContainer.scrollTop = lockedScrollTop;
      }
      return;
    }

    setIsUserScrolling(true);

    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    const timeout = isAudioPlaying ? 1500 : 3000;
    scrollTimeoutRef.current = setTimeout(() => setIsUserScrolling(false), timeout);
  }, [isAudioPlaying]);

  const handleWheelCapture = useCallback(
    (event: ReactWheelEvent<HTMLDivElement>) => {
      if (!isScrollLocked) {
        return;
      }

      const nativeEvent = event.nativeEvent;
      if (nativeEvent.cancelable) {
        nativeEvent.preventDefault();
      }
      event.stopPropagation();
    },
    [isScrollLocked]
  );

  const handleTouchMove = useCallback(
    (event: ReactTouchEvent<HTMLDivElement>) => {
      if (isScrollLocked) {
        event.stopPropagation();
      }
    },
    [isScrollLocked]
  );

  useEffect(() => {
    const openMenuKeys = openMenuKeysRef.current;

    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      // Force cleanup of virtualizer references
      lastScrollToIndexRef.current = null;
      isAnyMenuOpenRef.current = false;
      openMenuKeys.clear();
      suppressScrollEventRef.current = false;
    };
  }, []);

  // Track current audio time and update active segment
  useEffect(() => {
    const audioElement = audioPlayerRef.current?.audio.current;
    if (!audioElement) {
      return;
    }

    const updateTime = () => {
      const time = audioElement.currentTime;
      setActiveSegmentIndex(findActiveSegmentIndex(time));
    };

    const handlePlay = () => {
      setIsAudioPlaying(true);
      setTimeout(() => setIsUserScrolling(false), 500);
    };
    const handlePause = () => setIsAudioPlaying(false);
    const handleEnded = () => setIsAudioPlaying(false);

    audioElement.addEventListener("timeupdate", updateTime);
    audioElement.addEventListener("play", handlePlay);
    audioElement.addEventListener("pause", handlePause);
    audioElement.addEventListener("ended", handleEnded);

    // Initial playing state
    setIsAudioPlaying(!audioElement.paused);

    return () => {
      audioElement.removeEventListener("timeupdate", updateTime);
      audioElement.removeEventListener("play", handlePlay);
      audioElement.removeEventListener("pause", handlePause);
      audioElement.removeEventListener("ended", handleEnded);
    };
  }, [audioPlayerRef, findActiveSegmentIndex]);

  // Callback for speaker labeler menus to notify when they open/close
  const waitForNextFrame = useCallback(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      }),
    []
  );

  const handleMenuStateChange = useCallback(
    (segmentKey: string, isOpen: boolean) => {
      const openKeys = openMenuKeysRef.current;
      const scrollContainer = parentRef.current;

      if (isOpen) {
        if (openKeys.has(segmentKey)) {
          return;
        }
        openKeys.add(segmentKey);
        isAnyMenuOpenRef.current = true;
        if (scrollContainer) {
          scrollLockPositionRef.current = scrollContainer.scrollTop;
        }
        setActiveDrawerSegmentKey(segmentKey);
        return;
      }

      if (!openKeys.has(segmentKey)) {
        if (activeDrawerSegmentKey === segmentKey) {
          setActiveDrawerSegmentKey(null);
        }
        return;
      }

      openKeys.delete(segmentKey);

      if (openKeys.size === 0) {
        if (scrollContainer) {
          scrollLockPositionRef.current = scrollContainer.scrollTop;
        }
        isAnyMenuOpenRef.current = false;
        setIsScrollLocked(false);
        setIsUserScrolling(false);
        setActiveDrawerSegmentKey(null);
      }
    },
    [activeDrawerSegmentKey, setIsUserScrolling]
  );

  const prepareToOpenMenu = useCallback(
    async (segmentKey: string, buttonElement?: HTMLElement) => {
      const openKeys = openMenuKeysRef.current;

      if (openKeys.has(segmentKey)) {
        return;
      }

      if (buttonElement) {
        const rect = buttonElement.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;
        const popoverHeight = 400;
        const popoverWidth = 320;
        const padding = 16; // viewport padding

        let top: number;
        let left = rect.left + window.scrollX;

        // Determine if there's enough space below
        const spaceBelow = viewportHeight - rect.bottom;
        const spaceAbove = rect.top;

        if (spaceBelow >= popoverHeight || spaceBelow >= spaceAbove) {
          // Position below with minimal spacing
          top = rect.bottom + window.scrollY + 4;
          // If it would be cut off at bottom, move it up to fit
          if (rect.bottom + popoverHeight > viewportHeight) {
            top = viewportHeight - popoverHeight - padding + window.scrollY;
          }
        } else {
          // Position above with minimal spacing
          top = rect.top + window.scrollY - popoverHeight + 32;
          // If it would be cut off at top, move it down to fit
          if (top < window.scrollY + padding) {
            top = window.scrollY + padding;
          }
        }

        // Handle horizontal positioning
        if (rect.left + popoverWidth > viewportWidth) {
          // Align to right edge of viewport
          left = viewportWidth - popoverWidth - padding + window.scrollX;
        }

        // Ensure doesn't go past left edge
        if (left < window.scrollX + padding) {
          left = window.scrollX + padding;
        }

        setButtonPosition({ top, left });
      }

      let closedAny = false;
      if (openKeys.size > 0) {
        const keysToClose = Array.from(openKeys);
        keysToClose.forEach((key) => {
          if (key !== segmentKey) {
            menuStateManager.setMenuState(key, false);
            handleMenuStateChange(key, false);
            closedAny = true;
          }
        });
      }

      // Allow the virtualizer two frames to settle after closing the previous pill
      // Intentional because the virtualizer needs to render on final POS
      if (closedAny) {
        await waitForNextFrame();
        await waitForNextFrame();
      }

      const scrollContainer = parentRef.current;
      if (scrollContainer) {
        scrollLockPositionRef.current = scrollContainer.scrollTop;
      }

      if (!isScrollLocked) {
        setIsScrollLocked(true);
        await waitForNextFrame();
      } else {
        await waitForNextFrame();
      }

      openKeys.add(segmentKey);
      isAnyMenuOpenRef.current = true;
      setActiveDrawerSegmentKey(segmentKey);
    },
    [handleMenuStateChange, isScrollLocked, waitForNextFrame]
  );

  const handleDrawerRequestClose = useCallback(
    (segmentKey: string) => {
      handleMenuStateChange(segmentKey, false);
    },
    [handleMenuStateChange]
  );

  // Auto-scroll to the active segment when audio is playing and user isn't scrolling
  useEffect(() => {
    if (
      activeSegmentIndex === null ||
      isUserScrolling ||
      !isAudioPlaying ||
      isAnyMenuOpenRef.current
    ) {
      return;
    }

    // Skip if already scrolled to this index
    if (lastScrollToIndexRef.current === activeSegmentIndex) {
      return;
    }

    virtualizer.scrollToIndex(activeSegmentIndex, { align: "center", behavior: "smooth" });
    lastScrollToIndexRef.current = activeSegmentIndex;
  }, [activeSegmentIndex, isUserScrolling, isAudioPlaying, virtualizer]);

  const TimelineIndicator = ({ type, text }: { type: "start" | "end"; text: string }) => (
    <Flex align="center" mb={type === "start" ? 6 : 0} mt={type === "end" ? 6 : 0} gap={4} pl={4}>
      <Box position="relative" zIndex={1} w="28px" display="flex" justifyContent="center">
        <Box
          w="8px"
          h="8px"
          bg={type === "start" ? "green.400" : "red.400"}
          borderRadius="full"
          border="2px solid white"
          shadow="sm"
        />
      </Box>
      <Text fontSize="sm" color="gray.500" fontWeight="medium">
        {text}
      </Text>
    </Flex>
  );

  const TimelineContainer = ({ children }: { children: ReactNode }) => (
    <Box position="relative" px={{ base: 4, md: 8 }} maxW="4xl" mx="auto">
      <Box
        position="absolute"
        left={{ base: "46px", md: "62px" }}
        top="40px"
        bottom="40px"
        w="1px"
        bg="gray.200"
        zIndex={0}
      />
      {children}
    </Box>
  );

  return (
    <TranscriptScrollManager
      parentRef={parentRef}
      isScrollLocked={isScrollLocked}
      onScroll={handleScroll}
      onWheelCapture={handleWheelCapture}
      onTouchMove={handleTouchMove}
    >
      {/* Top spacer */}
      <Box h="20px" />

      {filteredIndices.length === 0 ? (
        <TimelineContainer>
          <TimelineIndicator type="start" text="Transcript Start" />

          {/* Loading content */}
          <Flex position="relative" mb={6} align="flex-start" gap={4} pl={4}>
            {/* Loading Avatar */}
            <Box position="relative" zIndex={1}>
              <Circle
                size="28px"
                bg="gray.300"
                color="white"
                fontWeight="bold"
                fontSize="xs"
                shadow="sm"
                animation="pulse 2s infinite"
              >
                ?
              </Circle>
            </Box>

            {/* Loading Content */}
            <Box flex={1} pt={0}>
              <HStack spacing={3} mb={1}>
                <Box
                  bg="gray.100"
                  borderRadius="full"
                  px={3}
                  py={1}
                  border="1px solid"
                  borderColor="gray.200"
                >
                  <Text fontSize="sm" fontWeight="medium" color="gray.500">
                    Processing...
                  </Text>
                </Box>
                <Text fontSize="xs" color="gray.400" fontWeight="medium">
                  --:--
                </Text>
              </HStack>
            </Box>
          </Flex>

          <TimelineIndicator type="end" text="Transcript End" />
        </TimelineContainer>
      ) : (
        <TimelineContainer>
          <TimelineIndicator type="start" text="Transcript Start" />

          <TranscriptVirtualizedList
            virtualizer={virtualizer}
            virtualItems={virtualItems}
            totalSize={totalSize}
            filteredIndices={filteredIndices}
            getSegmentData={getSegmentData}
            activeSegmentIndex={activeSegmentIndex}
            isMobile={isMobile}
            labelsToSpeaker={labelsToSpeaker}
            knownSpeakers={knownSpeakers}
            transcriptId={transcriptId}
            audioPlayerRef={audioPlayerRef}
            triggerSpeakerLabel={triggerSpeakerLabel}
            onOpenRelabelModal={onOpenRelabelModal}
            onMenuStateChange={handleMenuStateChange}
            onBeforeMenuOpen={prepareToOpenMenu}
          />

          <TimelineIndicator type="end" text="Transcript End" />
        </TimelineContainer>
      )}

      {/* Bottom spacer */}
      <Box h={`${bottomSpacing}px`} />

      <MobileSpeakerLabelerDrawer
        activeSegmentKey={activeDrawerSegmentKey}
        segments={transcript.segments}
        labelsToSpeaker={labelsToSpeaker}
        knownSpeakers={knownSpeakers}
        triggerSpeakerLabel={triggerSpeakerLabel}
        onOpenRelabelModal={onOpenRelabelModal}
        transcriptId={transcriptId}
        onRequestClose={handleDrawerRequestClose}
      />
      <DesktopSpeakerLabelerPopover
        activeSegmentKey={activeDrawerSegmentKey}
        segments={transcript.segments}
        labelsToSpeaker={labelsToSpeaker}
        knownSpeakers={knownSpeakers}
        triggerSpeakerLabel={triggerSpeakerLabel}
        onOpenRelabelModal={onOpenRelabelModal}
        transcriptId={transcriptId}
        onRequestClose={handleDrawerRequestClose}
        buttonPosition={buttonPosition}
      />
    </TranscriptScrollManager>
  );
};

export default Transcript;
