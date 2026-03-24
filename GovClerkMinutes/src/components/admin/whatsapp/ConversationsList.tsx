import { VStack, Text } from "@chakra-ui/react";
import { Conversation } from "@/admin/whatsapp/types";
import ConversationCard from "@/components/admin/whatsapp/ConversationCard";
import { Template } from "@/admin/whatsapp/api/templates";

type Props = {
  conversations: Conversation[];
  whatsappMessageTemplates: Template[];
  isSelected: (id: string) => boolean;
  onToggleSelected: (id: string, selected: boolean) => void;
  revalidateWhatsapps: () => void;
  onStartCall: (opts: { toWaId: string; phoneNumberId?: string }) => void;
};

export default function ConversationsList({
  conversations,
  whatsappMessageTemplates,
  isSelected,
  onToggleSelected,
  revalidateWhatsapps,
  onStartCall,
}: Props) {
  if (conversations.length === 0) {
    return <Text>No conversations found for this range.</Text>;
  }

  return (
    <VStack align="stretch" spacing={6} overflow="visible">
      {conversations.map((conversation) => (
        <ConversationCard
          key={conversation.conversationId}
          conversation={conversation}
          whatsappMessageTemplates={whatsappMessageTemplates}
          isSelected={isSelected(conversation.conversationId)}
          onToggleSelected={onToggleSelected}
          revalidateWhatsapps={revalidateWhatsapps}
          onStartCall={onStartCall}
        />
      ))}
    </VStack>
  );
}
