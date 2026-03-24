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
import PricingTable from "./dashboard-pricing/PricingTable";
import { ApiGetCustomerDetailsResponse } from "@/pages/api/get-customer-details";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  country: string | null;
  customerDetails: ApiGetCustomerDetailsResponse | null;
  transcriptId?: number;
};

const SimpleModal = ({ isOpen, onClose, country, customerDetails, transcriptId }: Props) => {
  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} size={["full", "6xl"]} scrollBehavior="outside">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Buy Tokens</ModalHeader>
          <ModalCloseButton />
          <ModalBody w="full">
            <Flex w="full" alignItems="center" justifyContent="center">
              <PricingTable
                country={country}
                customerDetails={customerDetails}
                transcriptId={transcriptId}
              />
            </Flex>
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="messenger" mr={3} onClick={onClose}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

export default SimpleModal;
