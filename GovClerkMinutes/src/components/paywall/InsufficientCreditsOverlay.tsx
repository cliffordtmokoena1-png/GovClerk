import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalBody,
  VStack,
  Heading,
  Text,
  Button,
  HStack,
  Spinner,
  Box,
  Alert,
  AlertIcon,
} from "@chakra-ui/react";
import { useEffect, useRef } from "react";
import { openWhatsAppChat } from "@/utils/whatsapp";

type Props = {
  tokensRequired: number;
  currentBalance: number;
  onBalanceSufficient: () => void;
  onAddCredits: () => void;
  transcriptId?: number | null;
};

const POLL_INTERVAL_MS = 5000;

/**
 * Persistent full-screen overlay shown when a user has uploaded a recording
 * that exceeds their available token balance. The overlay cannot be dismissed
 * manually — it polls /api/get-tokens every 5 seconds and auto-closes only
 * after the balance is confirmed to be sufficient.
 */
export default function InsufficientCreditsOverlay({
  tokensRequired,
  currentBalance,
  onBalanceSufficient,
  onAddCredits,
  transcriptId,
}: Props) {
  const deficit = tokensRequired - currentBalance;
  // Show WhatsApp top-up wall when the user has some tokens but only needs a small top-up
  const isSmallDeficit = currentBalance > 0 && deficit <= 10;
  const whatsappTopUpMessage = `Hi, I need ${deficit} more token${deficit === 1 ? "" : "s"} to transcribe my recording${transcriptId != null ? ` (transcript #${transcriptId})` : ""}. Can you help me add them?`;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/get-tokens", { method: "POST" });
        if (!res.ok) return;
        const data: { tokens: number } = await res.json();
        if (data.tokens >= tokensRequired) {
          if (intervalRef.current != null) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          onBalanceSufficient();
        }
      } catch {
        // Polling failure is non-fatal — try again on next tick.
      }
    }, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current != null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [tokensRequired, onBalanceSufficient]);

  return (
    <Modal
      isOpen
      onClose={() => {}}
      closeOnOverlayClick={false}
      closeOnEsc={false}
      isCentered
      motionPreset="slideInBottom"
    >
      <ModalOverlay bg="blackAlpha.800" backdropFilter="blur(8px)" />
      <ModalContent bg="white" boxShadow="2xl" borderRadius="xl" mx={4} my={4} maxW="md">
        <ModalBody py={8} px={6}>
          <VStack spacing={5} align="stretch">
            <VStack spacing={2} align="center">
              <Heading
                size="md"
                textAlign="center"
                color={isSmallDeficit ? "green.600" : "orange.600"}
              >
                {isSmallDeficit ? "Almost There!" : "Insufficient Credits"}
              </Heading>
              <Text fontSize="sm" color="gray.600" textAlign="center">
                {isSmallDeficit
                  ? `You need just ${deficit} more token${deficit === 1 ? "" : "s"} to complete this upload.`
                  : "Your recording cannot be transcribed with your current balance."}
              </Text>
            </VStack>

            <Alert status="warning" borderRadius="lg">
              <AlertIcon />
              <Text fontSize="sm">
                This recording requires{" "}
                <Text as="span" fontWeight="bold" color="orange.600">
                  {tokensRequired}
                </Text>{" "}
                tokens, but you only have{" "}
                <Text as="span" fontWeight="bold" color="orange.600">
                  {currentBalance}
                </Text>{" "}
                token{currentBalance === 1 ? "" : "s"}.
              </Text>
            </Alert>

            <VStack spacing={3} align="stretch">
              {isSmallDeficit ? (
                <>
                  <Button
                    colorScheme="green"
                    size="lg"
                    width="full"
                    onClick={() => openWhatsAppChat(whatsappTopUpMessage, "whatsapp_topup")}
                  >
                    Request Tokens via WhatsApp
                  </Button>
                  <Button variant="outline" size="lg" width="full" onClick={onAddCredits}>
                    Add More Credits
                  </Button>
                </>
              ) : (
                <>
                  <Button colorScheme="orange" size="lg" width="full" onClick={onAddCredits}>
                    Add More Credits
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    width="full"
                    onClick={() =>
                      openWhatsAppChat(
                        "Hi, I need help adding credits to transcribe my recording. Can you assist?",
                        "insufficient_credits"
                      )
                    }
                  >
                    Contact Support
                  </Button>
                </>
              )}
            </VStack>

            <Box textAlign="center">
              <HStack justifyContent="center" spacing={2}>
                <Spinner size="xs" color="gray.400" />
                <Text fontSize="xs" color="gray.400">
                  Checking for updated balance every 5 seconds...
                </Text>
              </HStack>
            </Box>
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
