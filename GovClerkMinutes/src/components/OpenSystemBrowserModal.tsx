import React, { useEffect, useState } from "react";
import {
  Button,
  Text,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Flex,
} from "@chakra-ui/react";
import IconWordmark from "./IconWordmark";
import Image from "next/image";

type Props = {
  isOpen: boolean;
  onClose: () => void;
};
export default function OpenSystemBrowserModal({ isOpen, onClose }: Props) {
  const [fixScroll, setFixScroll] = useState(false);

  useEffect(() => {
    if (isOpen && fixScroll) {
      const modalContent = document.querySelector(".chakra-modal__content-container");
      if (modalContent) {
        modalContent.scrollTo(0, 0);
      }
    }
  }, [isOpen, fixScroll]);

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} size="full" scrollBehavior="outside">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            <IconWordmark />
          </ModalHeader>
          <ModalBody w="full">
            <Flex flexDir="column" w="full" gap={4}>
              <Flex flexDir="column" gap={1}>
                <Text>We work best in your browser!</Text>
                <Text>
                  Follow the{" "}
                  <Text as="span" textDecor="underline" fontWeight="bold">
                    two steps
                  </Text>{" "}
                  in the{" "}
                  <Text as="span" textDecor="underline" fontWeight="bold">
                    green circles
                  </Text>
                </Text>
              </Flex>
              <Flex boxShadow="dark-lg">
                <Image
                  src="/open_external_browser.jpg"
                  alt="open system browser"
                  loading="eager"
                  width={1179}
                  onLoad={() => {
                    setFixScroll(true);
                  }}
                />
              </Flex>
            </Flex>
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="gray" onClick={onClose}>
              Continue
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
