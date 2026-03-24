import { Box, HStack, IconButton, Text } from "@chakra-ui/react";
import ConversationCard from "@/components/admin/whatsapp/ConversationCard";
import type { Conversation } from "@/admin/whatsapp/types";
import type { Template } from "@/admin/whatsapp/api/templates";
import { FiArrowLeft, FiInfo } from "react-icons/fi";
import ProspectInfoDrawer from "@/components/admin/whatsapp/ProspectInfoDrawer";
import { useState } from "react";

type Props = {
  conversation: Conversation | null;
  whatsappMessageTemplates: Template[];
  onBack: () => void;
  onRevalidate: () => void;
  onStartCall: (opts: { toWaId: string; phoneNumberId?: string }) => void;
};

export default function MobileChatView({
  conversation,
  whatsappMessageTemplates,
  onBack,
  onRevalidate,
  onStartCall,
}: Props) {
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  return (
    <Box h="100%" display="flex" flexDirection="column">
      <HStack
        px={2}
        py={2}
        borderBottomWidth="1px"
        bg="white"
        align="center"
        justify="space-between"
      >
        <IconButton
          aria-label="Back to inbox"
          icon={<FiArrowLeft />}
          variant="ghost"
          onClick={onBack}
        />
        <Text fontWeight="semibold" noOfLines={1} flex={1} textAlign="center" px={2}>
          {conversation?.leadName || conversation?.whatsappId || "Chat"}
        </Text>
        <IconButton
          aria-label="Show contact details"
          icon={<FiInfo />}
          variant="ghost"
          onClick={() => setIsInfoOpen(true)}
          isDisabled={!conversation}
        />
      </HStack>

      {conversation ? (
        <ConversationCard
          conversation={conversation}
          whatsappMessageTemplates={whatsappMessageTemplates}
          isSelected={false}
          onToggleSelected={() => {}}
          revalidateWhatsapps={onRevalidate}
          autoScrollToBottom
          hideProspectInfo
          onStartCall={onStartCall}
        />
      ) : (
        <Box
          h="full"
          borderWidth="1px"
          borderRadius="lg"
          bg="white"
          display="flex"
          alignItems="center"
          justifyContent="center"
          color="gray.500"
          mx={2}
          mt={2}
        >
          <Text fontSize="sm">Select a conversation from Inbox.</Text>
        </Box>
      )}

      <ProspectInfoDrawer
        conversation={conversation}
        isOpen={isInfoOpen}
        onClose={() => setIsInfoOpen(false)}
      />
    </Box>
  );
}
