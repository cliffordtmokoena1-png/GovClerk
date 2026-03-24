import { Box, HStack, Button, Text, Icon, Badge, VisuallyHidden } from "@chakra-ui/react";
import { FiInbox, FiMessageCircle } from "react-icons/fi";
import React from "react";

type Props = {
  activeTab: "inbox" | "chat";
  onChange: (tab: "inbox" | "chat") => void;
  unreadCount?: number;
};

// Mobile-only bottom navigation bar to switch between Inbox and Chat views
export default function MobileTabBar({ activeTab, onChange, unreadCount }: Props) {
  const hasUnread = typeof unreadCount === "number" && unreadCount > 0;

  return (
    <Box
      role="tablist"
      aria-label="WhatsApp navigation"
      position="fixed"
      bottom={0}
      left={0}
      right={0}
      display="block"
      bg="white"
      borderTopWidth="1px"
      zIndex={20}
      // Add padding for iOS safe area
      sx={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 8px)" }}
    >
      <HStack spacing={0} justify="space-around" py={2}>
        <Button
          role="tab"
          aria-selected={activeTab === "inbox"}
          variant="ghost"
          onClick={() => onChange("inbox")}
          colorScheme={activeTab === "inbox" ? "purple" : undefined}
          height="56px"
          px={4}
        >
          <Box position="relative" display="flex" alignItems="center" gap={2}>
            <Icon as={FiInbox} boxSize={5} />
            <Text fontSize="sm">Inbox</Text>
            {hasUnread && (
              <Badge
                variant="solid"
                colorScheme="purple"
                borderRadius="full"
                minW="18px"
                h="18px"
                display="inline-flex"
                alignItems="center"
                justifyContent="center"
                ml={1}
              >
                <VisuallyHidden>Unread conversations</VisuallyHidden>
                {Math.min(unreadCount || 0, 99)}
              </Badge>
            )}
          </Box>
        </Button>

        <Button
          role="tab"
          aria-selected={activeTab === "chat"}
          variant="ghost"
          onClick={() => onChange("chat")}
          colorScheme={activeTab === "chat" ? "purple" : undefined}
          height="56px"
          px={4}
        >
          <Box display="flex" alignItems="center" gap={2}>
            <Icon as={FiMessageCircle} boxSize={5} />
            <Text fontSize="sm">Chat</Text>
          </Box>
        </Button>
      </HStack>
    </Box>
  );
}
