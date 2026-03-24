import { Box, Flex, Text } from "@chakra-ui/react";
import { keyframes } from "@emotion/react";
import { useEffect, useState } from "react";

const pulseAnimation = keyframes`
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
  100% {
    opacity: 1;
  }
`;

type Props = {
  currentStep: number;
  nonNullTranscriptCount?: number;
  totalTranscriptCount?: number;
  uploadPct?: number;
};

const MultiStepProgress = ({
  currentStep,
  nonNullTranscriptCount,
  totalTranscriptCount,
  uploadPct,
}: Props) => {
  const [progressValue, setProgressValue] = useState<number>(0);
  const steps = [
    { label: "Upload", pct: 25 },
    { label: "Detect", pct: 50 },
    { label: "Transcribe", pct: 75 },
    { label: "Done", pct: 100 },
  ];

  useEffect(() => {
    let intervalId: any;
    const getRandomDelay = () => Math.floor(Math.random() * (1500 - 500 + 1)) + 500;

    if (currentStep === 1) {
      setProgressValue(Math.max(1, Math.min(25, 25.0 * (uploadPct || 0))));
    } else if (currentStep === 2) {
      setProgressValue((prevValue) => {
        const nextValue = Math.max(25, prevValue);
        return nextValue >= 50 ? 45 : nextValue;
      });
      intervalId = setInterval(() => {
        setProgressValue((prevValue) => {
          const nextValue = Math.max(25, prevValue + 2);
          return nextValue >= 50 ? 45 : nextValue;
        });
      }, getRandomDelay());
    } else if (currentStep === 3) {
      const range = 75 - 50;
      const increment =
        nonNullTranscriptCount != null && totalTranscriptCount != null
          ? range * (nonNullTranscriptCount / totalTranscriptCount)
          : 0;
      setProgressValue(50 + increment);
    } else if (currentStep === 4) {
      setProgressValue(100);
    }

    return () => clearInterval(intervalId);
  }, [currentStep, nonNullTranscriptCount, totalTranscriptCount, uploadPct]);

  return (
    <Box w="full" position="relative" h="1px" bg="gray.100">
      <Box
        position="absolute"
        left="0"
        top="0"
        h="full"
        bg="blue.500"
        transition="width 0.3s ease"
        w={`${progressValue}%`}
        animation={currentStep < 4 ? `${pulseAnimation} 2s ease-in-out infinite` : "none"}
      />
      {steps.map((step, index) => (
        <Box
          key={step.label}
          position="absolute"
          left={`${step.pct}%`}
          top="50%"
          transform="translate(-50%, -50%)"
        >
          <Box
            w="4px"
            h="4px"
            borderRadius="full"
            bg={currentStep >= index + 1 ? "blue.500" : "gray.200"}
            position="relative"
          >
            <Text
              position="absolute"
              top="-20px"
              left="50%"
              transform="translateX(-50%)"
              fontSize="xs"
              color={currentStep >= index + 1 ? "gray.700" : "gray.400"}
              whiteSpace="nowrap"
              fontWeight={currentStep >= index + 1 ? "medium" : "normal"}
            >
              {step.label}
            </Text>
          </Box>
        </Box>
      ))}
    </Box>
  );
};

export default MultiStepProgress;
