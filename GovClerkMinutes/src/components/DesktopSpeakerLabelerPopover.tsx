import { Box, Portal, Fade, useBreakpointValue } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { menuStateManager } from "@/utils/menuState";
import { useSpeakerLabelerMenu } from "@/hooks/useSpeakerLabeler";
import type { SpeakerLabelerComponentBaseProps } from "@/hooks/useSpeakerLabeler";
import { SpeakerLabelerContent } from "@/components/meetings/SpeakerLabeler";

type DesktopSpeakerLabelerPopoverProps = SpeakerLabelerComponentBaseProps & {
  buttonPosition?: { top: number; left: number } | null;
};

const POPOVER_BASE_STYLE: CSSProperties = Object.freeze({
  position: "fixed",
  zIndex: 1000,
  minWidth: 320,
  maxWidth: 400,
  borderRadius: "1rem",
  background: "white",
  border: "1px solid #E2E8F0",
  overflow: "hidden",
});

export function DesktopSpeakerLabelerPopover({
  activeSegmentKey,
  segments,
  labelsToSpeaker,
  knownSpeakers,
  triggerSpeakerLabel,
  onOpenRelabelModal,
  transcriptId,
  onRequestClose,
  buttonPosition,
}: DesktopSpeakerLabelerPopoverProps) {
  const isMobile = useBreakpointValue({ base: true, md: false }) ?? false;

  const {
    segment,
    sortedSpeakers,
    onSpeakerLabeled,
    userInputName,
    setUserInputName,
    resetUserInputName,
    handleClose,
  } = useSpeakerLabelerMenu({
    activeSegmentKey,
    segments,
    labelsToSpeaker,
    knownSpeakers,
    triggerSpeakerLabel,
    onOpenRelabelModal,
    transcriptId,
    onRequestClose,
  });

  // Subscribe to menu state changes
  const [isMenuOpen, setIsMenuOpen] = useState(() =>
    activeSegmentKey ? menuStateManager.getMenuState(activeSegmentKey) : false
  );

  useEffect(() => {
    if (!activeSegmentKey) {
      setIsMenuOpen(false);
      return;
    }

    setIsMenuOpen(menuStateManager.getMenuState(activeSegmentKey));

    const unsubscribe = menuStateManager.subscribe(activeSegmentKey, (isOpen) => {
      setIsMenuOpen(isOpen);
    });

    return unsubscribe;
  }, [activeSegmentKey]);

  const shouldRender = Boolean(segment && buttonPosition);
  const isOpen = shouldRender && isMenuOpen;

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    resetUserInputName();

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest("[data-popover-content]")) {
        handleClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, resetUserInputName, handleClose]);

  // Don't render on mobile, we already have a different labeler for mobile
  if (isMobile) {
    return null;
  }

  // Only render the portal if we have the required props (segment, buttonPosition)
  // We render even when isOpen is false to allow the exit animation to play
  if (!segment || !buttonPosition) {
    return null;
  }

  const popoverStyle: CSSProperties = {
    ...POPOVER_BASE_STYLE,
    top: buttonPosition.top,
    left: buttonPosition.left,
  };

  return (
    <Portal>
      <Fade in={isOpen}>
        <Box style={popoverStyle} onClick={(e) => e.stopPropagation()} data-popover-content>
          <SpeakerLabelerContent
            labelsToSpeaker={labelsToSpeaker}
            knownSpeakers={knownSpeakers}
            selectedLabel={segment.speaker}
            sortedSpeakers={sortedSpeakers}
            transcriptId={transcriptId}
            segmentStart={segment.start}
            segmentStop={segment.stop}
            onSpeakerLabeled={(name, label, options) => {
              resetUserInputName();
              onSpeakerLabeled(name, label, options);
            }}
            onOpenRelabelModal={
              onOpenRelabelModal
                ? () => {
                    resetUserInputName();
                    setTimeout(() => {
                      onOpenRelabelModal(segment.speaker, segment.start, segment.stop);
                    }, 0);
                  }
                : undefined
            }
            menuOnClose={handleClose}
            userInputName={userInputName}
            setUserInputName={setUserInputName}
            isDesktop
          />
        </Box>
      </Fade>
    </Portal>
  );
}
