import React from "react";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  Text,
  VStack,
  ListItem,
  UnorderedList,
} from "@chakra-ui/react";
import { getPrettyPlanName, SubscriptionPlan } from "@/utils/price";
import { ApiGetCustomerDetailsResponse } from "@/pages/api/get-customer-details";

interface ResubscribeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  planName: SubscriptionPlan;
  tokensPerMonth: number;
  price: string;
  priceUnit: string;
  nextBillDate: string;
  subscriptionData?: ApiGetCustomerDetailsResponse;
}

const ResubscribeModal: React.FC<ResubscribeModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  planName,
  tokensPerMonth,
  price,
  priceUnit,
  nextBillDate,
  subscriptionData,
}) => {
  const billingPeriod = subscriptionData?.interval === "year" ? "year" : "month";
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Confirm plan</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={2} align="stretch">
            <Text>
              Resubscribe to <strong>GovClerkMinutes {getPrettyPlanName(planName)}</strong>?
            </Text>
            <UnorderedList spacing={2}>
              <ListItem>You will not be billed until {nextBillDate}</ListItem>
              <ListItem>
                On that date, you will be charged {priceUnit}
                {price} for the {billingPeriod}
              </ListItem>
              <ListItem>On that date, you will get {tokensPerMonth} tokens</ListItem>
            </UnorderedList>
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button colorScheme="orange" mr={3} onClick={onConfirm}>
            Confirm
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default ResubscribeModal;
