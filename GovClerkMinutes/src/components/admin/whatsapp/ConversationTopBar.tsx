import {
  Box,
  HStack,
  Avatar,
  Text,
  IconButton,
  Button,
  Checkbox,
  Tooltip,
  useToast,
} from "@chakra-ui/react";
import { ExternalLinkIcon, LinkIcon } from "@chakra-ui/icons";
import { ChevronDownIcon, ChevronRightIcon } from "@chakra-ui/icons";
import { MdScheduleSend } from "react-icons/md";
import { Conversation } from "@/admin/whatsapp/types";
import ConversationActiveIndicator from "@/components/admin/whatsapp/ConversationActiveIndicator";
import { serializeFilters } from "@/admin/whatsapp/filter/filters";
import type { Filter } from "@/admin/whatsapp/filter/types";

type Props = {
  conversation: Conversation;
  isSelected: boolean;
  open: boolean;
  onToggleSelected: (id: string, selected: boolean) => void;
  onToggleOpen: () => void;
  onOpenScheduler: () => void;
  onOpenCredit: () => void;
  onStartCall: (opts: { toWaId: string; phoneNumberId?: string }) => void;
};

export default function ConversationTopBar({
  conversation,
  isSelected,
  open,
  onToggleSelected,
  onToggleOpen,
  onOpenScheduler,
  onOpenCredit,
  onStartCall,
}: Props) {
  const toast = useToast();
  const prettyStartedAt = new Date(conversation.startedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });

  const copyPermalink = async () => {
    const filters: Filter[] = [{ type: "phone", value: conversation.whatsappId }];
    const f = serializeFilters(filters);
    const url = `${window.location.origin}/admin?tool=5&f=${encodeURIComponent(f)}`;
    await navigator.clipboard.writeText(url);
    toast({
      title: "Permalink copied",
      description: "Link saved to clipboard",
      status: "success",
      duration: 2500,
      isClosable: true,
      position: "top",
    });
  };

  return (
    <Box
      position="sticky"
      top={0}
      zIndex={100}
      bg="gray.50"
      borderBottom="1px solid"
      borderColor="gray.200"
      py={{ base: 1, md: 2 }}
    >
      <HStack
        spacing={1}
        flexWrap="wrap"
        alignItems={{ base: "flex-start", md: "center" }}
        w="100%"
      >
        <Checkbox
          isChecked={!!isSelected}
          onChange={(e) => onToggleSelected(conversation.conversationId, e.target.checked)}
          mr={1}
          aria-label="Select conversation"
          size="lg"
        />
        <IconButton
          aria-label={open ? "Collapse" : "Expand"}
          icon={open ? <ChevronDownIcon /> : <ChevronRightIcon />}
          size="lg"
          variant="ghost"
          onClick={onToggleOpen}
        />
        <Avatar name={conversation.leadName || "Unknown"} size="sm" />
        <Text fontWeight="bold" fontSize={{ base: "sm", md: "md" }}>
          {conversation.leadName || "Unknown"}
        </Text>
        <Text fontSize={{ base: "xs", md: "sm" }} color="gray.500">
          Started: {prettyStartedAt}
        </Text>
        <Button size="sm" colorScheme="whatsapp" variant="ghost" onClick={onOpenScheduler}>
          <MdScheduleSend size={20} />
          &nbsp; Schedule
        </Button>
        <Button size="sm" ml={-2} colorScheme="yellow" variant="ghost" onClick={onOpenCredit}>
          💰&nbsp; Credit
        </Button>
        <Button
          size="sm"
          ml={-2}
          colorScheme="blue"
          variant="ghost"
          onClick={() =>
            onStartCall({
              toWaId: conversation.whatsappId,
              phoneNumberId: conversation.businessWhatsappId,
            })
          }
          isDisabled={!conversation.whatsappId}
        >
          📞 Call
        </Button>
        {/* Wati link with external icon */}
        <a
          href={`https://live.wati.io/461839/teamInbox/${conversation.conversationId}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: "flex", alignItems: "center" }}
        >
          <Text
            color="blue.500"
            fontSize={{ base: "xs", md: "sm" }}
            textDecoration="underline"
            mr={1}
          >
            Open in Wati
          </Text>
          <ExternalLinkIcon color="blue.500" />
        </a>

        <ConversationActiveIndicator conversation={conversation} />
        <Tooltip label="Copy permalink" placement="top">
          <IconButton
            aria-label="Copy permalink"
            icon={<LinkIcon />}
            size="sm"
            variant="ghost"
            ml="auto"
            onClick={copyPermalink}
            isDisabled={!conversation.whatsappId}
          />
        </Tooltip>
      </HStack>
    </Box>
  );
}
