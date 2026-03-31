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
  Icon,
} from "@chakra-ui/react";
import { useEffect, useRef } from "react";
import { FiLock } from "react-icons/fi";
import { openWhatsAppChat } from "@/utils/whatsapp";

type Props = {
  onUpgradeClick: () => void;
};

const POLL_INTERVAL_MS = 5000;

/**
 * Hard upgrade wall shown when a user's token balance is zero or negative.
 * Blocks all upload and recording actions. Polls /api/get-tokens every 5 seconds;
 * when a positive balance is detected (plan upgraded), reloads the page automatically.
 */
export default function UpgradeRequiredWall({ onUpgradeClick }: Props) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/get-tokens", { method: "POST" });
        if (!res.ok) return;
        const data: { tokens: number } = await res.json();
        if (data.tokens > 0) {
          if (intervalRef.current != null) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          // Plan is now active — refresh so the upload interface is re-enabled.
          window.location.reload();
        }
      } catch (err) {
        // Polling failure is non-fatal — try again on next tick.
        console.warn("[UpgradeRequiredWall] Token polling failed:", err);
      }
    }, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current != null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  return (
    <Modal
      isOpen
      onClose={() => {}}
      closeOnOverlayClick={false}
      closeOnEsc={false}
      isCentered
      motionPreset="slideInBottom"
    >
      <ModalOverlay bg="blackAlpha.900" backdropFilter="blur(8px)" />
      <ModalContent bg="white" boxShadow="2xl" borderRadius="xl" mx={4} my={4} maxW="md">
        <ModalBody py={8} px={6}>
          <VStack spacing={5} align="stretch">
            <VStack spacing={3} align="center">
              <Box p={4} bg="red.50" borderRadius="full">
                <Icon as={FiLock} boxSize={8} color="red.500" />
              </Box>
              <Heading size="md" textAlign="center" color="red.600">
                Upgrade Required
              </Heading>
              <Text fontSize="sm" color="gray.600" textAlign="center">
                You&apos;ve used all your tokens. Upgrade to a plan to continue uploading and
                recording.
              </Text>
            </VStack>

            <VStack spacing={3} align="stretch">
              <Button colorScheme="orange" size="lg" width="full" onClick={onUpgradeClick}>
                Upgrade Plan
              </Button>
              <Button
                variant="outline"
                size="lg"
                width="full"
                onClick={() =>
                  openWhatsAppChat(
                    "Hi, I've used all my tokens and would like to upgrade my plan. Can you help?",
                    "upgrade_required_wall"
                  )
                }
              >
                Contact Support via WhatsApp
              </Button>
            </VStack>

            <Box textAlign="center">
              <HStack justifyContent="center" spacing={2}>
                <Spinner size="xs" color="gray.400" />
                <Text fontSize="xs" color="gray.400">
                  Waiting for plan upgrade — page will refresh automatically...
                </Text>
              </HStack>
            </Box>
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
