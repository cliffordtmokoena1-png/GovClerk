import React, { useState, useEffect } from "react";
import {
  Box,
  VStack,
  Text,
  Icon,
  Button,
  Spinner,
  HStack,
  useBreakpointValue,
} from "@chakra-ui/react";
import { FiAlertCircle, FiRefreshCw, FiList, FiCheckCircle, FiAlertTriangle } from "react-icons/fi";
import { safeCapture } from "@/utils/safePosthog";

type RecordingErrorDisplayProps = {
  error: string;
  onTryAgain: () => void;
  transcriptId?: number;
};

export default function RecordingErrorDisplay({
  error,
  onTryAgain,
  transcriptId,
}: RecordingErrorDisplayProps) {
  const buttonSize = useBreakpointValue({ base: "md", md: "lg" });

  const [recoveryState, setRecoveryState] = useState<null | "loading" | "success" | "failure">(
    null
  );

  const isExpired = /expired/i.test(error);

  useEffect(() => {
    if (isExpired) {
      return; // Do not attempt auto-recovery for expired sessions
    }
    if (transcriptId != null && recoveryState === null) {
      (async () => {
        setRecoveryState("loading");
        try {
          const res = await fetch("/api/recorder/recover", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ transcriptId }),
          });
          if (!res.ok) {
            throw new Error(`status ${res.status}`);
          }
          safeCapture("recording_recovery_succeeded", { transcript_id: transcriptId });
          setRecoveryState("success");
        } catch (err) {
          safeCapture("recording_recovery_failed", {
            transcript_id: transcriptId,
            error_message: err instanceof Error ? err.message : String(err),
          });
          setRecoveryState("failure");
        }
      })();
    }
  }, [transcriptId, recoveryState, isExpired]);

  return (
    <VStack spacing={6} textAlign="center" maxW="400px">
      <Box p={4} borderRadius="full" bg="red.100" border="2px solid" borderColor="red.300">
        <Icon as={FiAlertCircle} boxSize={10} color="red.500" />
      </Box>

      <VStack spacing={3}>
        <Text
          fontSize={{ base: "lg", md: "xl" }}
          fontWeight="bold"
          color="red.700"
          lineHeight="shorter"
        >
          {isExpired ? "Session Expired" : "Recording Failed"}
        </Text>

        <Text fontSize={{ base: "sm", md: "md" }} color="red.600" lineHeight="relaxed" maxW="350px">
          {error}
        </Text>

        <Text
          fontSize={{ base: "xs", md: "sm" }}
          color="gray.600"
          lineHeight="relaxed"
          maxW="320px"
        >
          This incident has been logged and sent to the team.
        </Text>
      </VStack>

      <VStack spacing={3} w="full" maxW="280px">
        <Button
          leftIcon={<FiRefreshCw />}
          colorScheme="red"
          size={buttonSize}
          w="full"
          onClick={onTryAgain}
          _hover={{
            transform: "translateY(-1px)",
            boxShadow: "md",
          }}
          transition="all 0.2s"
        >
          New Recording
        </Button>

        <Button
          leftIcon={<FiList />}
          variant="outline"
          colorScheme="blue"
          size={{ base: "sm", md: "md" }}
          w="full"
          as="a"
          href="/recordings"
          _hover={{
            transform: "translateY(-1px)",
            boxShadow: "sm",
          }}
          transition="all 0.2s"
        >
          View Recordings
        </Button>

        {!isExpired && recoveryState === "loading" && (
          <HStack spacing={2} align="center">
            <Spinner size="sm" />
            <Text fontSize="sm" color="gray.600">
              Attempting automatic recovery...
            </Text>
          </HStack>
        )}
        {!isExpired && recoveryState === "success" && (
          <HStack spacing={2} align="center">
            <Icon as={FiCheckCircle} boxSize={4} color="green.600" />
            <Text fontSize="sm" color="green.600">
              Recovered with data loss.
            </Text>
          </HStack>
        )}
        {!isExpired && recoveryState === "failure" && (
          <HStack spacing={2} align="center">
            <Icon as={FiAlertTriangle} boxSize={4} color="red.600" />
            <Text fontSize="sm" color="red.600">
              Automatic recovery failed.
            </Text>
          </HStack>
        )}
      </VStack>
    </VStack>
  );
}
