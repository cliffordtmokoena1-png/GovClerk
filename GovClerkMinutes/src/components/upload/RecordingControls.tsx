import React, { useEffect, useRef } from "react";
import {
  Button,
  Text,
  Box,
  Spinner,
  useBreakpointValue,
  VStack,
  HStack,
  Icon,
  Flex,
} from "@chakra-ui/react";
import { FiMic, FiPlay, FiPause, FiSquare, FiAlertCircle } from "react-icons/fi";
import { useRecordingState } from "@/contexts/RecordingStateContext";
import useWakeLock from "@/hooks/useWakeLock";
import useNavigationWarningIf from "@/hooks/useNavigationWarning";
import RecordingErrorDisplay from "./RecordingErrorDisplay";
import { formatBytes, formatDuration } from "@/utils/format";
import router from "next/router";

type RecordingControlsProps = {
  transcriptId: number;
};

export default function RecordingControls({ transcriptId }: RecordingControlsProps) {
  const {
    recordingState,
    sessionId,
    duration,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    isSupported,
    isClient,
    error,
    totalFileSize,
  } = useRecordingState();

  const interfaceRef = useRef<HTMLDivElement>(null);
  const wakeLock = useWakeLock();

  const buttonSize = useBreakpointValue({ base: "md", md: "lg" });
  const micIconSize = useBreakpointValue({ base: 8, md: 12 });

  // Warn before navigating away during recording
  const isRecordingInProgress = recordingState === "recording" || recordingState === "paused";
  useNavigationWarningIf(isRecordingInProgress);

  // Auto-start recording once per new transcript without session id, but not if there's an error
  useEffect(() => {
    if (
      transcriptId &&
      !sessionId &&
      isClient &&
      isSupported &&
      recordingState === "idle" &&
      !error
    ) {
      startRecording(transcriptId);
    }
  }, [transcriptId, sessionId, isClient, isSupported, recordingState, startRecording, error]);

  // Accessibility: focus UI when recording starts
  useEffect(() => {
    if (recordingState === "recording" && interfaceRef.current) {
      interfaceRef.current.focus();
    }
  }, [recordingState]);

  // Keep device awake during recording
  useEffect(() => {
    if (isRecordingInProgress) {
      wakeLock.request();
    } else {
      wakeLock.release();
    }
  }, [isRecordingInProgress, wakeLock]);

  // Show loading spinner until hydration
  if (!isClient) {
    return (
      <Flex justify="center" align="center" minH="60px">
        <Spinner size="md" />
      </Flex>
    );
  }

  // Browser doesn't support MediaRecorder
  if (!isSupported) {
    return (
      <VStack spacing={2} maxW="300px">
        <Text fontSize="sm" color="gray.600" textAlign="center">
          Audio recording not supported in this browser
        </Text>
      </VStack>
    );
  }

  // Show any recording errors
  if (error) {
    return (
      <RecordingErrorDisplay
        error={error}
        onTryAgain={() => {
          router.push("/dashboard");
        }}
        transcriptId={transcriptId}
      />
    );
  }

  // Renders the red/paused indicators and timer
  const renderRecordingIndicator = () => {
    if (recordingState === "recording") {
      return (
        <VStack spacing={4}>
          <Box position="relative">
            <Icon
              as={FiMic}
              boxSize={micIconSize}
              color="red.500"
              animation="pulse 1.5s infinite"
            />
          </Box>
          <VStack spacing={2}>
            <HStack spacing={3}>
              <Text fontSize={{ base: "lg", md: "xl" }} fontWeight="bold" color="red.600">
                Recording
              </Text>
            </HStack>
            <Text
              fontSize={{ base: "2xl", md: "3xl" }}
              fontWeight="bold"
              fontFamily="mono"
              color="red.600"
              letterSpacing="1px"
            >
              {formatDuration(duration)}
            </Text>
            <Text
              fontSize={{ base: "xs", md: "sm" }}
              color="gray.500"
              textAlign="center"
              maxW="280px"
              mt={2}
            >
              Please don’t close this tab while recording
            </Text>
          </VStack>
        </VStack>
      );
    }

    if (recordingState === "paused") {
      return (
        <VStack spacing={4}>
          <Icon as={FiPause} boxSize={micIconSize} color="orange.500" />
          <VStack spacing={2}>
            <HStack spacing={3}>
              <Text fontSize={{ base: "lg", md: "xl" }} fontWeight="bold" color="orange.600">
                Paused
              </Text>
            </HStack>
            <Text
              fontSize={{ base: "2xl", md: "3xl" }}
              fontWeight="bold"
              fontFamily="mono"
              color="orange.600"
              letterSpacing="1px"
            >
              {formatDuration(duration)}
            </Text>
            <Text
              fontSize={{ base: "xs", md: "sm" }}
              color="gray.500"
              textAlign="center"
              maxW="280px"
              mt={2}
            >
              Recording paused
            </Text>
          </VStack>
        </VStack>
      );
    }

    return null;
  };

  // Renders the control buttons + status
  const renderControls = () => {
    switch (recordingState) {
      case "idle":
        return (
          <Flex w="full" h="full" alignItems="center" justifyContent="center">
            <VStack spacing={4}>
              <Spinner size="lg" color="blue.500" thickness="3px" />
              <Text color="gray.600" fontSize="md">
                Loading transcript...
              </Text>
            </VStack>
          </Flex>
        );
      case "requesting-permission":
        return (
          <VStack spacing={3}>
            <Spinner size="md" color="red.500" />
            <Text fontSize="sm" fontWeight="semibold" color="red.600">
              Setting up...
            </Text>
          </VStack>
        );

      case "permission-denied":
        return (
          <VStack spacing={3}>
            <Icon as={FiAlertCircle} boxSize={10} color="red.500" />
            <Text fontSize="sm" fontWeight="semibold" color="red.600">
              Microphone access denied
            </Text>
            <Text fontSize="sm" color="gray.500">
              Please refresh the page and grant microphone access
            </Text>
          </VStack>
        );

      case "recording":
        return (
          <VStack spacing={6} align="center">
            {renderRecordingIndicator()}
            <HStack spacing={3} wrap="wrap" justify="center">
              <Button
                leftIcon={<FiPause />}
                onClick={pauseRecording}
                colorScheme="orange"
                size={buttonSize}
              >
                Pause
              </Button>
              <Button
                leftIcon={<FiSquare />}
                onClick={stopRecording}
                colorScheme="gray"
                size={buttonSize}
              >
                Stop
              </Button>
            </HStack>
            <Text fontSize="sm" color="gray.500">
              {formatBytes(totalFileSize)} used
            </Text>
          </VStack>
        );

      case "paused":
        return (
          <VStack spacing={6} align="center">
            {renderRecordingIndicator()}
            <HStack spacing={3} wrap="wrap" justify="center">
              <Button
                leftIcon={<FiPlay />}
                onClick={resumeRecording}
                colorScheme="green"
                size={buttonSize}
              >
                Resume
              </Button>
              <Button
                leftIcon={<FiSquare />}
                onClick={stopRecording}
                colorScheme="gray"
                size={buttonSize}
              >
                Stop
              </Button>
            </HStack>
            <Text fontSize="sm" color="gray.500">
              {formatBytes(totalFileSize)} used
            </Text>
          </VStack>
        );

      case "processing":
        return (
          <VStack spacing={4} align="center">
            <Spinner size="lg" color="blue.500" thickness="4px" />
            <Text fontSize="lg" fontWeight="semibold" color="blue.600">
              Finalizing recording...
            </Text>
            <Text fontSize="sm" color="gray.600" textAlign="center">
              Please wait while we process your recording
            </Text>
            <Text fontSize="sm" color="gray.500">
              {formatBytes(totalFileSize)} used
            </Text>
          </VStack>
        );

      default:
        return null;
    }
  };

  return (
    <VStack ref={interfaceRef} spacing={4} align="center" w="full" tabIndex={-1}>
      {renderControls()}
    </VStack>
  );
}
