import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  VStack,
  HStack,
  Text,
  Box,
  useToast,
} from "@chakra-ui/react";
import { useState } from "react";
import { colorFromString } from "@/utils/color";
import CircleIcon from "./CircleIcon";
import { findIndexOfMatchingValue, Speaker } from "@/lib/speakerLabeler";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  currentSpeakerLabel: string;
  segmentStart: string;
  segmentStop: string;
  onRelabelSuccess: (newSpeakerLabel: string, segmentStart: string, segmentStop: string) => void;
  labelsToSpeaker: { [key: string]: Speaker };
  transcriptId: number;
};

export default function RelabelSegmentModal({
  isOpen,
  onClose,
  currentSpeakerLabel,
  segmentStart,
  segmentStop,
  onRelabelSuccess,
  labelsToSpeaker,
  transcriptId,
}: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSpeaker, setSelectedSpeaker] = useState<string | null>(null);
  const toast = useToast();

  const allSpeakers = Object.entries(labelsToSpeaker);
  const availableSpeakers = allSpeakers.filter(
    ([speakerLabel]) => speakerLabel !== currentSpeakerLabel
  );

  const handleRelabel = async () => {
    if (!selectedSpeaker) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/relabel-segment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transcriptId,
          segmentStart,
          segmentStop,
          newSpeakerLabel: selectedSpeaker,
        }),
      });

      const result = await response.json();

      if (result.success) {
        onRelabelSuccess(selectedSpeaker, segmentStart, segmentStop);
        toast({
          title: "Segment relabeled",
          description: "The segment has been successfully relabeled.",
          status: "success",
          duration: 3000,
          isClosable: true,
        });
        onClose();
      } else {
        throw new Error(result.error || "Failed to relabel segment");
      }
    } catch (error) {
      console.error("Error relabeling segment:", error);
      toast({
        title: "Error",
        description: "Failed to relabel segment. Please try again.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedSpeaker(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="md">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Relabel Segment</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4} align="stretch">
            <Text fontSize="sm" color="gray.600">
              Choose a different speaker for this segment:
            </Text>

            <VStack spacing={1} align="stretch" maxH="300px" overflowY="auto">
              {availableSpeakers.map(([speakerLabel, speakerData]) => (
                <Box
                  key={speakerLabel}
                  p={2}
                  borderRadius="md"
                  bg={selectedSpeaker === speakerLabel ? "blue.50" : "transparent"}
                  cursor="pointer"
                  _hover={{ bg: selectedSpeaker === speakerLabel ? "blue.100" : "gray.50" }}
                  onClick={() => setSelectedSpeaker(speakerLabel)}
                >
                  <HStack spacing={3} align="center">
                    <CircleIcon
                      boxSize={4}
                      color={
                        speakerData.uses > 0
                          ? colorFromString(speakerData.name || speakerLabel)
                          : "gray.300"
                      }
                    />
                    <Text fontWeight="medium" flex={1}>
                      {speakerData.uses > 0
                        ? speakerData.name
                        : `Speaker ${findIndexOfMatchingValue(allSpeakers, speakerLabel) + 1}`}
                    </Text>
                  </HStack>
                </Box>
              ))}
            </VStack>

            {availableSpeakers.length === 0 && (
              <Text fontSize="sm" color="gray.500" textAlign="center" py={4}>
                No other speakers available for this transcript.
              </Text>
            )}
          </VStack>
        </ModalBody>

        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={handleClose}>
            Cancel
          </Button>
          <Button
            colorScheme="blue"
            onClick={handleRelabel}
            isLoading={isLoading}
            isDisabled={!selectedSpeaker}
          >
            Relabel Segment
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
