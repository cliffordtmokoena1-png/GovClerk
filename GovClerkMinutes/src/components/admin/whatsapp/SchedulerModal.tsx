import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
} from "@chakra-ui/react";
import WhatsappFollowupForm from "./WhatsappFollowupForm";
import { Conversation } from "@/admin/whatsapp/types";
import type { Template } from "@/admin/whatsapp/api/templates";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  whatsappMessageTemplates: Template[];
  conversation: Conversation;
  revalidateWhatsapps?: () => void;
};

export default function SchedulerModal({
  isOpen,
  onClose,
  whatsappMessageTemplates,
  conversation,
  revalidateWhatsapps,
}: Props) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Schedule WhatsApp Message</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <WhatsappFollowupForm
            whatsappMessageTemplates={whatsappMessageTemplates}
            conversation={conversation}
            onScheduled={() => {
              if (revalidateWhatsapps) {
                revalidateWhatsapps();
              }
              onClose();
            }}
          />
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
