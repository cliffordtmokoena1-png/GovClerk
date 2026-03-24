import {
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  useBreakpointValue,
  Flex,
} from "@chakra-ui/react";
import { useEffect } from "react";
import { useSpeakerLabelerMenu } from "@/hooks/useSpeakerLabeler";
import type { SpeakerLabelerComponentBaseProps } from "@/hooks/useSpeakerLabeler";
import { SpeakerLabelerContent } from "@/components/meetings/SpeakerLabeler";

type MobileSpeakerLabelerDrawerProps = SpeakerLabelerComponentBaseProps & {
  hideCurrentlyEditing?: boolean;
};

export function MobileSpeakerLabelerDrawer({
  activeSegmentKey,
  segments,
  labelsToSpeaker,
  knownSpeakers,
  triggerSpeakerLabel,
  onOpenRelabelModal,
  transcriptId,
  onRequestClose,
  hideCurrentlyEditing = false,
}: MobileSpeakerLabelerDrawerProps) {
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

  const isOpen = Boolean(isMobile && segment);

  useEffect(() => {
    if (isOpen) {
      resetUserInputName();
    }
  }, [isOpen, resetUserInputName]);

  if (!isMobile) {
    return null;
  }

  return (
    <Drawer
      isOpen={isOpen}
      placement="bottom"
      onClose={handleClose}
      size="full"
      closeOnOverlayClick={false}
      closeOnEsc
    >
      <DrawerOverlay />
      <DrawerContent
        borderTopRadius="2xl"
        pb={4}
        pt={2}
        px={2}
        maxH="90dvh"
        h="auto"
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <DrawerCloseButton top={6} right={6} size="sm" />
        <DrawerHeader textAlign="center" fontSize="md" fontWeight="semibold">
          Label Speakers
        </DrawerHeader>
        <DrawerBody
          px={0}
          pt={2}
          overflowY="auto"
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <Flex direction="column" pb={4}>
            {segment && (
              <SpeakerLabelerContent
                labelsToSpeaker={labelsToSpeaker}
                knownSpeakers={knownSpeakers}
                selectedLabel={segment.speaker}
                sortedSpeakers={sortedSpeakers}
                transcriptId={transcriptId}
                segmentStart={segment.start}
                segmentStop={segment.stop}
                segmentText={segment.transcript || undefined}
                onSpeakerLabeled={onSpeakerLabeled}
                onOpenRelabelModal={
                  onOpenRelabelModal
                    ? () => onOpenRelabelModal(segment.speaker, segment.start, segment.stop)
                    : undefined
                }
                menuOnClose={handleClose}
                userInputName={userInputName}
                setUserInputName={setUserInputName}
                isDesktop={false}
                hideCurrentlyEditing={hideCurrentlyEditing}
              />
            )}
          </Flex>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}
