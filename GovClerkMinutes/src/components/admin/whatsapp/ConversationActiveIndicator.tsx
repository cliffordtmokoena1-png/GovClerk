import React from "react";
import { Box, HStack, Text } from "@chakra-ui/react";
import { Conversation } from "@/admin/whatsapp/types";
import { getConversationActiveStatus } from "@/admin/whatsapp/utils";

type Props = {
  conversation: Conversation;
};

export default function ConversationActiveIndicator({ conversation }: Props) {
  const status = getConversationActiveStatus(conversation);

  if (status.status === "inactive") {
    return (
      <HStack spacing={1} align="center" px={2}>
        <Box boxSize="8px" borderRadius="full" bg="gray.500" />
        <Text color="gray.500" fontSize={{ base: "xs", md: "sm" }}>
          Inactive
        </Text>
      </HStack>
    );
  }

  const now = Date.now();
  const expiresAt = status.lastInboundMsg.getTime() + 24 * 60 * 60 * 1000;
  const remainingMs = Math.max(0, expiresAt - now);
  const remainingH = Math.floor(remainingMs / (60 * 60 * 1000));
  const remainingM = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
  const indicatorText =
    remainingH >= 1 ? `Active for next ${remainingH}h` : `Active for next ${remainingM}m`;

  return (
    <HStack spacing={1} align="center" pl={4}>
      <Box boxSize="8px" borderRadius="full" bg="red.500" />
      <Text color="red.500" fontSize={{ base: "xs", md: "sm" }}>
        {indicatorText}
      </Text>
    </HStack>
  );
}
