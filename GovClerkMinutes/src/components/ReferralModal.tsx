import React from "react";
import {
  Button,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  Flex,
} from "@chakra-ui/react";

type Props = {
  isOpen: boolean;
  onClose: () => void;
};
const ReferralModal = ({ isOpen, onClose }: Props) => {
  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} size={["full", "3xl"]}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Thank you!</ModalHeader>
          <ModalCloseButton />
          <ModalBody w="full">
            <Flex w="full">
              We are currently working on a referral program. Please check back soon!
            </Flex>
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="blue" mr={3} onClick={onClose}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

export default ReferralModal;
