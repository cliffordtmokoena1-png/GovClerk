import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
} from "@chakra-ui/react";
import TokenManagementForm from "./TokenManagementForm";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialWhatsappId?: string;
};

export default function TokenModal({ isOpen, onClose, onSuccess, initialWhatsappId }: Props) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="3xl" isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Manage Tokens</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={10}>
          <TokenManagementForm
            initialWhatsappId={initialWhatsappId}
            onSuccess={() => {
              if (onSuccess) {
                onSuccess();
              }
              onClose();
            }}
          />
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
