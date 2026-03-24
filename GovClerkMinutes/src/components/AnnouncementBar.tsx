import { Box, Text, Button, VStack, Flex, IconButton, useBreakpointValue } from "@chakra-ui/react";
import { CloseIcon } from "@chakra-ui/icons";
import { useAnnouncements } from "@/contexts/AnnouncementContext";
import {
  Announcement,
  AnnouncementVariant,
  ANNOUNCEMENT_BAR_HEIGHT_PX,
} from "@/types/announcement";
import { useRouter } from "next/router";
import React from "react";

const getVariantColors = (variant: AnnouncementVariant) => {
  switch (variant) {
    case "info":
      return { bg: "blue.500", color: "white" };
    case "warning":
      return { bg: "orange.500", color: "white" };
    case "error":
      return { bg: "red.500", color: "white" };
    case "success":
      return { bg: "green.500", color: "white" };
    case "slow-network":
      return { bg: "gray.700", color: "white" };
    default:
      return { bg: "gray.700", color: "white" };
  }
};

function parseTextWithBold(text: string): React.ReactNode {
  const parts = text.split(/(\*\*.*?\*\*)/g);

  return parts.map((part, index) => {
    if (!part) {
      return null;
    }

    if (part.startsWith("**") && part.endsWith("**")) {
      const boldText = part.slice(2, -2);
      return (
        <Text as="span" fontWeight="bold" key={index}>
          {boldText}
        </Text>
      );
    }
    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}

type SingleAnnouncementProps = {
  announcement: Announcement;
  isMobile: boolean;
  bg: string;
  color: string;
  onDismiss: (id: string) => void;
  onAction?: () => void;
};

function SingleAnnouncement({
  announcement,
  isMobile,
  bg,
  color,
  onDismiss,
  onAction,
}: SingleAnnouncementProps) {
  const actionButton =
    announcement.action || announcement.actionLink ? (
      <Button
        size="xs"
        bg="white"
        color="gray.800"
        _hover={{
          bg: "gray.100",
        }}
        transition="background 0.2s"
        onClick={onAction}
        px={4}
        fontSize="xs"
        h="24px"
      >
        {announcement.actionText || "Action"}
      </Button>
    ) : null;

  const dismissButton = announcement.dismissible ? (
    <IconButton
      aria-label="Dismiss announcement"
      icon={<CloseIcon boxSize={2.5} />}
      size="xs"
      variant="ghost"
      color={color}
      _hover={{
        bg: "whiteAlpha.300",
      }}
      onClick={() => onDismiss(announcement.id)}
      minW="24px"
      h="24px"
    />
  ) : null;

  if (isMobile) {
    return (
      <Flex w="full" justify="space-between" align="center" gap={2}>
        <Text fontSize="xs" flex={1} lineHeight="1.4">
          {parseTextWithBold(announcement.text)}
        </Text>
        <Flex gap={2} align="center" flexShrink={0}>
          {actionButton}
          {dismissButton}
        </Flex>
      </Flex>
    );
  }

  return (
    <Flex align="center" w="full" position="relative">
      <Flex gap={3} align="center" justify="center" w="full">
        <Text fontSize="xs" lineHeight="1.4">
          {parseTextWithBold(announcement.text)}
        </Text>
        {actionButton}
      </Flex>
      <Box position="absolute" right={0}>
        {dismissButton}
      </Box>
    </Flex>
  );
}

export default function AnnouncementBar() {
  const { announcements, dismissAnnouncement } = useAnnouncements();
  const router = useRouter();
  const isMobile = useBreakpointValue({ base: true, md: false });

  if (announcements.length === 0) {
    return null;
  }

  const handleAction = (announcement: Announcement) => {
    if (announcement.action) {
      announcement.action();
    } else if (announcement.actionLink) {
      router.push(announcement.actionLink);
    }
  };

  return (
    <Box position="fixed" top={0} right={0} left={0} zIndex={1000} width="100vw">
      <VStack spacing={0} align="stretch">
        {announcements.map((announcement) => {
          const colors = getVariantColors(announcement.variant);
          const bg = announcement.customBg || colors.bg;
          const color = announcement.customColor || colors.color;

          return (
            <Box
              key={announcement.id}
              bg={bg}
              color={color}
              width="100%"
              boxShadow="sm"
              h={{ base: "auto", md: `${ANNOUNCEMENT_BAR_HEIGHT_PX}px` }}
              minH={`${ANNOUNCEMENT_BAR_HEIGHT_PX}px`}
              py={{ base: 2, md: 0 }}
              display="flex"
              alignItems="center"
              px={{ base: 3, md: 4 }}
            >
              <Box w="full">
                <SingleAnnouncement
                  announcement={announcement}
                  isMobile={isMobile ?? false}
                  bg={bg}
                  color={color}
                  onDismiss={dismissAnnouncement}
                  onAction={() => handleAction(announcement)}
                />
              </Box>
            </Box>
          );
        })}
      </VStack>
    </Box>
  );
}

export function useAnnouncementBarHeight() {
  const { announcements } = useAnnouncements();
  return announcements.length * ANNOUNCEMENT_BAR_HEIGHT_PX;
}
