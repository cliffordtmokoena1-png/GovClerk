import { Text, Button, Flex, Spinner, IconButton } from "@chakra-ui/react";
import { useState } from "react";
import { BsInfoCircleFill } from "react-icons/bs";
import { ApiLabelSpeakerResponseResult1 } from "@/pages/api/label-speaker";
import { SIMILARITY_THRESHOLD } from "@/common/constants";
import { safeCapture } from "@/utils/safePosthog";

type Props = {
  showInstructions: boolean;
  paywallIsShowing: boolean;
  uploadKind: string;
  transcriptFinished: boolean;
  waitingForMinutes: boolean;
  isLoading: boolean;
  isPreview: boolean;
  isPreviewTranscriptEmpty?: boolean;
  onGetYourMinutesClicked: () => void;
  speakerData?: ApiLabelSpeakerResponseResult1;
  transcriptId: number;
};

export default function GetYourMinutes({
  showInstructions,
  paywallIsShowing,
  uploadKind,
  transcriptFinished,
  waitingForMinutes,
  isLoading,
  isPreview,
  isPreviewTranscriptEmpty,
  onGetYourMinutesClicked,
  speakerData,
  transcriptId,
}: Props) {
  const [isClicked, setIsClicked] = useState(false);

  const scrollToTop = () => {
    const el = document.querySelector("#product-page");
    if (el == null) {
      return;
    }
    el.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const checkAcceptedSuggestions = () => {
    if (!speakerData?.labelsToSpeaker) {
      return;
    }

    Object.entries(speakerData.labelsToSpeaker).forEach(([label, speaker]) => {
      const validSuggestion = speaker.suggestedSpeakers?.find(
        (s) => s.similarityScore >= SIMILARITY_THRESHOLD
      );
      if (validSuggestion && speaker.name === validSuggestion.name) {
        safeCapture("speaker_suggestion_accepted", {
          transcript_id: transcriptId,
          speaker_label: label,
          speaker_name: speaker.name,
          suggestion_score: validSuggestion.similarityScore,
        });
      }
    });
  };

  return (
    <Flex
      alignItems="center"
      justifyContent="space-between"
      width="100%"
      px={4}
      py={1}
      bg={!transcriptFinished ? "orange.100" : "blue.100"}
      position="sticky"
      top={0}
      zIndex={4}
    >
      <Flex alignItems="center" gap={2} color={!transcriptFinished ? "orange.600" : "blue.600"}>
        <BsInfoCircleFill size={15} />
        <Text fontSize="sm" color="black" fontWeight="semibold" maxW={{ base: "48", sm: "xl" }}>
          Preview from first 10 minutes of the meeting
        </Text>
      </Flex>
      <Button
        colorScheme="orange"
        size="sm"
        isDisabled={isClicked || waitingForMinutes || (!transcriptFinished && !paywallIsShowing)}
        onClick={() => {
          if (isPreview && showInstructions && paywallIsShowing) {
            scrollToTop();
            return;
          }
          setIsClicked(true);
          if (isPreview) {
            checkAcceptedSuggestions();
          }
          onGetYourMinutesClicked();
        }}
        isLoading={isClicked || isLoading}
        leftIcon={
          transcriptFinished ? undefined : (
            <Spinner size="sm" color={!transcriptFinished ? "orange.600" : "blue.600"} />
          )
        }
      >
        {!transcriptFinished ? "Processing..." : "Finish minutes"}
      </Button>
    </Flex>
  );
}
