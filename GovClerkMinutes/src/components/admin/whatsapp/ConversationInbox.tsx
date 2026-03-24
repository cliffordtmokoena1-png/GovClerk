import React, { useLayoutEffect, useRef, useState } from "react";
import { Box, Button, Flex, HStack, List, ListItem, Spinner, Text, VStack } from "@chakra-ui/react";
import FilterBar from "@/components/admin/whatsapp/FilterBar";
import type { Conversation, SortOption } from "@/admin/whatsapp/types";
import type { Filter } from "@/admin/whatsapp/filter/types";
import SortControls from "@/components/admin/whatsapp/SortControls";

function hasUnreadMessages(conversation: Conversation, optimisticLastReadMs?: number): boolean {
  const { messages, lastReadAt } = conversation;
  if (messages.length === 0) {
    return false;
  }

  const baseMs = lastReadAt ? Date.parse(lastReadAt) : undefined;
  let lastReadMs: number | undefined = baseMs;
  if (typeof optimisticLastReadMs === "number") {
    if (typeof baseMs === "number" && !Number.isNaN(baseMs)) {
      lastReadMs = Math.max(baseMs, optimisticLastReadMs);
    } else {
      lastReadMs = optimisticLastReadMs;
    }
  }

  if (typeof lastReadMs !== "number" || Number.isNaN(lastReadMs)) {
    return true;
  }

  for (let i = messages.length - 1; i >= 0; i--) {
    const ms = Date.parse(messages[i].timestamp);
    if (!Number.isNaN(ms)) {
      if (ms > lastReadMs) {
        return true;
      }
      if (ms <= lastReadMs) {
        return false;
      }
    }
  }

  return false;
}

type Props = {
  conversations: Conversation[];
  filters: Filter[];
  onFiltersChanged: (next: Filter[]) => void;
  selectedId: string | null;
  onSelect: (conversationId: string) => void;
  hasMore?: boolean;
  onLoadMore?: () => void;
  loadingMore?: boolean;
  isLoading?: boolean;
  errorText?: string | null;
  sortOption: SortOption;
  onSortChange: (sortOption: SortOption) => void;
};

export default function ConversationInbox({
  conversations,
  filters,
  onFiltersChanged,
  selectedId,
  onSelect,
  hasMore,
  onLoadMore,
  loadingMore,
  isLoading,
  errorText,
  sortOption,
  onSortChange,
}: Props) {
  const [optimisticReadMsById, setOptimisticReadMsById] = useState<Record<string, number>>({});
  // Preserve scroll position across re-renders and data revalidations
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const savedScrollTopRef = useRef(0);

  // Save scrollTop on scroll
  const handleScroll = () => {
    const el = scrollRef.current;
    if (el) {
      savedScrollTopRef.current = el.scrollTop;
    }
  };

  // Restore scrollTop after conversations change (e.g., SWR revalidation)
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) {
      return;
    }
    // Clamp to valid range in case content size changed
    const maxScrollTop = Math.max(0, el.scrollHeight - el.clientHeight);
    const nextScrollTop = Math.min(savedScrollTopRef.current, maxScrollTop);
    if (el.scrollTop !== nextScrollTop) {
      el.scrollTop = nextScrollTop;
    }
  }, [conversations]);

  const items = conversations.map((c) => {
    const lastMsg = c.messages[c.messages.length - 1];
    const tsStr = (lastMsg?.timestamp || c.startedAt) ?? new Date().toISOString();
    const ts = new Date(tsStr);
    const preview = lastMsg?.text || "";
    const unread = hasUnreadMessages(c, optimisticReadMsById[c.conversationId]);
    return {
      id: c.conversationId,
      name: c.leadName || c.whatsappId,
      timestamp: ts,
      preview,
      unread,
    };
  });

  return (
    <VStack align="stretch" spacing={3} h="100%" minH={0}>
      <FilterBar filters={filters} onFiltersChanged={onFiltersChanged} />
      <SortControls sortOption={sortOption} onSortChange={onSortChange} />

      <Box
        ref={scrollRef}
        onScroll={handleScroll}
        flex={1}
        minH={0}
        overflowY="auto"
        borderWidth="1px"
        borderRadius="md"
        bg="white"
      >
        {isLoading && (
          <Flex align="center" justify="center" py={6}>
            <Spinner />
          </Flex>
        )}
        {errorText && !isLoading && (
          <Text color="red.500" px={3} py={2} fontSize="sm">
            {errorText}
          </Text>
        )}

        <List>
          {items.map((it) => (
            <ListItem
              key={it.id}
              role="button"
              onClick={() => {
                setOptimisticReadMsById((prev) => ({ ...prev, [it.id]: Date.now() }));
                onSelect(it.id);
              }}
              _hover={{ bg: "gray.50" }}
              bg={selectedId === it.id ? "purple.50" : "transparent"}
              borderLeftWidth="4px"
              borderLeftColor={selectedId === it.id ? "purple.400" : "transparent"}
              transition="background 0.2s"
              px={3}
              py={3}
              h="100px"
              cursor="pointer"
            >
              <HStack align="start" spacing={3}>
                <Box flex={1} minW={0}>
                  <HStack justify="space-between" align="baseline" spacing={3}>
                    <HStack spacing={2}>
                      <Text fontWeight="semibold" noOfLines={1}>
                        {it.name}
                      </Text>
                      {it.unread && (
                        <Box
                          as="span"
                          aria-label="Unread messages"
                          title="Unread messages"
                          bg="purple.400"
                          borderRadius="full"
                          boxSize="8px"
                          display="inline-block"
                          flexShrink={0}
                        />
                      )}
                    </HStack>
                    <Text
                      fontSize="xs"
                      color="gray.500"
                      whiteSpace="nowrap"
                      suppressHydrationWarning
                    >
                      {it.timestamp.toLocaleString()}
                    </Text>
                  </HStack>
                  <Text fontSize="sm" color="gray.600" noOfLines={2} mt={1}>
                    {it.preview}
                  </Text>
                </Box>
              </HStack>
            </ListItem>
          ))}
        </List>

        <Flex justify="center" py={3}>
          {hasMore ? (
            <Button size="sm" onClick={onLoadMore} isLoading={!!loadingMore} variant="outline">
              Load more
            </Button>
          ) : (
            <Text fontSize="xs" color="gray.500">
              {conversations.length === 0 && !isLoading ? "No conversations" : "End of list"}
            </Text>
          )}
        </Flex>
      </Box>
    </VStack>
  );
}
