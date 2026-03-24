import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
  useBreakpointValue,
} from "@chakra-ui/react";

type Props = {
  isOpen: boolean;
  onAccept: () => void;
};

export default function UploadWarningModal({ isOpen, onAccept }: Props) {
  const isMobile = useBreakpointValue({ base: true, md: false });

  const message = isMobile
    ? "Uploading recordings on mobile requires you to avoid closing the browser or using other tabs and apps while processing the recording."
    : "Please avoid closing the browser window or putting your device to sleep while the recording is being uploaded and processed.";

  return (
    <Modal isOpen={isOpen} onClose={onAccept} isCentered>
      <ModalOverlay />
      <ModalContent mx={4}>
        <ModalHeader>Before you upload</ModalHeader>
        <ModalBody>
          <Text>{message}</Text>
        </ModalBody>
        <ModalFooter>
          <Button colorScheme="blue" onClick={onAccept}>
            Accept
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
