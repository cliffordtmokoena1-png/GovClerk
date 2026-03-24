import React, { useEffect, useState } from "react";
import { Box, Button, Flex, Text, Icon, CloseButton } from "@chakra-ui/react";
import { FiDownload } from "react-icons/fi";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const PWA_DISMISSED_KEY = "pwa-install-dismissed";

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
    const wasDismissed = localStorage.getItem(PWA_DISMISSED_KEY);

    if (isStandalone || wasDismissed) {
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      return;
    }

    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;

    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem(PWA_DISMISSED_KEY, "true");
  };

  if (!showPrompt) {
    return null;
  }

  return (
    <Box
      w="full"
      bg="blue.50"
      borderWidth="1px"
      borderColor="blue.200"
      borderRadius="lg"
      p={3}
      mb={3}
    >
      <Flex align="center" gap={3}>
        <Icon as={FiDownload} boxSize={5} color="blue.600" flexShrink={0} />

        <Flex direction="column" flex={1}>
          <Text fontSize="sm" fontWeight="semibold" color="gray.800">
            Install GovClerkMinutes
          </Text>
          <Text fontSize="xs" color="gray.600">
            Quick access from your home screen
          </Text>
        </Flex>

        <Button size="sm" colorScheme="blue" onClick={handleInstallClick} flexShrink={0}>
          Install
        </Button>

        <CloseButton
          size="sm"
          onClick={handleDismiss}
          aria-label="Dismiss install prompt"
          flexShrink={0}
        />
      </Flex>
    </Box>
  );
}
