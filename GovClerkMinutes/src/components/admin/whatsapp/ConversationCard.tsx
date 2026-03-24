import { Box, Divider, useDisclosure, VStack } from "@chakra-ui/react";
import { Conversation } from "@/admin/whatsapp/types";
import MessageList from "@/components/admin/whatsapp/MessageList";
import { useEffect, useMemo, useRef, useState, memo } from "react";
import useMarkConversationRead from "@/admin/whatsapp/hooks/useMarkConversationRead";
import SchedulerModal from "@/components/admin/whatsapp/SchedulerModal";
import TokenModal from "@/components/admin/token/TokenModal";
import ConversationTopBar from "@/components/admin/whatsapp/ConversationTopBar";
import Composer from "@/components/admin/whatsapp/Composer";
import type { Message } from "@/admin/whatsapp/types";
import ProspectInfo from "@/components/admin/whatsapp/ProspectInfo";
import type { Template } from "@/admin/whatsapp/api/templates";

interface ConversationCardProps {
  conversation: Conversation;
  whatsappMessageTemplates: Template[];
  isSelected: boolean;
  onToggleSelected: (id: string, selected: boolean) => void;
  revalidateWhatsapps: () => void;
  autoScrollToBottom?: boolean;
  hideProspectInfo?: boolean;
  onStartCall: (opts: { toWaId: string; phoneNumberId?: string }) => void;
}
function ConversationCard({
  conversation,
  whatsappMessageTemplates,
  isSelected,
  onToggleSelected,
  revalidateWhatsapps,
  autoScrollToBottom,
  hideProspectInfo,
  onStartCall,
}: ConversationCardProps) {
  const [open, setOpen] = useState(true);
  const {
    isOpen: isScheduleOpen,
    onOpen: onOpenSchedule,
    onClose: onCloseSchedule,
  } = useDisclosure();
  const { isOpen: isCreditOpen, onOpen: onOpenCredit, onClose: onCloseCredit } = useDisclosure();
  // Keep optimistic messages per conversation to avoid bleed when switching
  const [optimisticByConversationId, setOptimisticByConversationId] = useState<
    Record<string, Message[]>
  >({});
  // Track last known server message count per conversation to clear optimistics when server catches up
  const serverCountByIdRef = useRef<Record<string, number>>({});
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // If server-provided messages length changes, clear optimistic list (server caught up)
  useEffect(() => {
    const convId = conversation.conversationId;
    const serverCount = conversation.messages.length;
    const prevCount = serverCountByIdRef.current[convId];
    if (prevCount == null) {
      serverCountByIdRef.current[convId] = serverCount;
    } else if (serverCount !== prevCount) {
      // Server count changed, clear optimistics for this conversation
      setOptimisticByConversationId((prev) => {
        const existing = prev[convId];
        if (!existing || existing.length === 0) {
          return prev;
        }
        return { ...prev, [convId]: [] };
      });
    }
  }, [conversation.conversationId, conversation.messages.length]);

  const messages = useMemo(() => {
    const optimistic = optimisticByConversationId[conversation.conversationId] || [];
    return [...conversation.messages, ...optimistic];
  }, [conversation.messages, optimisticByConversationId, conversation.conversationId]);

  // Mark conversation as read on mount and when new messages arrive
  useMarkConversationRead({ conversation, revalidateWhatsapps });

  // Scroll to the bottom on initial open and whenever messages change
  useEffect(() => {
    if (!autoScrollToBottom) {
      return;
    }
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "auto", block: "end" });
    }
  }, [autoScrollToBottom, conversation.conversationId]);

  useEffect(() => {
    if (!autoScrollToBottom) {
      return;
    }
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [autoScrollToBottom, messages.length]);

  return (
    <>
      <SchedulerModal
        isOpen={isScheduleOpen}
        onClose={onCloseSchedule}
        whatsappMessageTemplates={whatsappMessageTemplates}
        conversation={conversation}
        revalidateWhatsapps={revalidateWhatsapps}
      />
      <TokenModal
        isOpen={isCreditOpen}
        onClose={onCloseCredit}
        initialWhatsappId={conversation.whatsappId}
        onSuccess={() => {
          if (revalidateWhatsapps) {
            revalidateWhatsapps();
          }
        }}
      />
      <Box
        p={{ base: 2, md: 5, xl: 6 }}
        bg="gray.50"
        borderRadius="lg"
        boxShadow="sm"
        border="1px solid"
        borderColor="gray.200"
        w="100%"
        maxW="100%"
        overflow="hidden"
        display="flex"
        flexDirection="column"
        h="100%"
      >
        <ConversationTopBar
          conversation={conversation}
          isSelected={isSelected}
          open={open}
          onToggleSelected={onToggleSelected}
          onToggleOpen={() => setOpen((v) => !v)}
          onOpenScheduler={onOpenSchedule}
          onOpenCredit={onOpenCredit}
          onStartCall={onStartCall}
        />
        <Divider mb={3} />
        <Box flex={1} minH={0} display="flex" flexDirection="column">
          {open ? (
            <Box
              data-testid="messages-scroll-area"
              flex={1}
              minH={0}
              overflowY="auto"
              pr={1}
              alignContent="end"
            >
              <VStack align="stretch" spacing={3}>
                <ProspectInfo conversation={conversation} hide={!open || !!hideProspectInfo} />
                <MessageList
                  messages={messages}
                  scheduleRequests={conversation.scheduleRequests}
                  source={conversation.source}
                />
                <Box ref={messagesEndRef} />
              </VStack>
            </Box>
          ) : null}
          {open ? (
            <Box
              data-testid="composer"
              borderTop="1px solid"
              borderColor="gray.200"
              pt={2}
              bg="gray.50"
            >
              <Composer
                conversation={conversation}
                onOptimisticMessage={({ action, message }) => {
                  const convId = conversation.conversationId;
                  if (action === "ADD") {
                    setOptimisticByConversationId((prev) => {
                      const list = prev[convId] || [];
                      return { ...prev, [convId]: [...list, message] };
                    });
                  } else if (action === "REMOVE") {
                    setOptimisticByConversationId((prev) => {
                      const list = prev[convId] || [];
                      const isSame = (a: Message, b: Message) => {
                        if (a.messageId && b.messageId) {
                          return a.messageId === b.messageId;
                        } else {
                          return a.timestamp === b.timestamp && a.text === b.text;
                        }
                      };
                      return { ...prev, [convId]: list.filter((m) => !isSame(m, message)) };
                    });
                  }
                }}
              />
            </Box>
          ) : null}
        </Box>
      </Box>
    </>
  );
}

// Only re-render if selection state or conversation/messageTemplates reference changes
const MemoConversationCard = memo(
  ConversationCard,
  (prev, next) =>
    prev.isSelected === next.isSelected &&
    prev.conversation === next.conversation &&
    prev.whatsappMessageTemplates === next.whatsappMessageTemplates &&
    prev.autoScrollToBottom === next.autoScrollToBottom
);

export default MemoConversationCard;
