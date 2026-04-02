import React from "react";
import { Box, Text, Button, VStack, Heading } from "@chakra-ui/react";
import ManagePaymentButton from "@/components/ManagePaymentButton";
import { formatPrice } from "@/utils/price";
import { ApiGetCustomerDetailsResponse } from "@/pages/api/get-customer-details";

interface PaymentInfoProps {
  subscriptionData: ApiGetCustomerDetailsResponse;
  subscriptionActive: boolean;
  subscriptionPaused: boolean;
  price: number;
  priceUnit: string;
  showDevTerminateButton: boolean;
  isTerminating: boolean;
  handleDevCancel: () => void;
}

export default function PaymentInfo({
  subscriptionData,
  subscriptionActive,
  subscriptionPaused,
  price,
  priceUnit,
  showDevTerminateButton,
  isTerminating,
  handleDevCancel,
}: PaymentInfoProps) {
  return (
    <VStack align="stretch" spacing={4}>
      {(subscriptionActive || subscriptionPaused) && (
        <Box borderWidth={1} borderColor="gray.200" p={4} borderRadius="md" boxShadow="sm">
          <Heading size="sm" mb={2}>
            Billing Information
          </Heading>
          <Text fontSize="sm" color="gray.600">
            {subscriptionActive ? (
              <>
                Your subscription will automatically renew on{" "}
                <strong>{subscriptionData.nextBillDate}</strong> and you&apos;ll be charged{" "}
                <strong>
                  {priceUnit}
                  {formatPrice(price)}
                </strong>
                .
              </>
            ) : (
              <>
                Your subscription will be canceled on{" "}
                <strong>{subscriptionData.nextBillDate}</strong>. No further charges will be made
                after this date.
              </>
            )}
          </Text>
        </Box>
      )}

      <Box borderWidth={1} borderColor="gray.200" p={4} borderRadius="md" boxShadow="sm">
        <Heading size="sm" mb={2}>
          Payment Method
        </Heading>
        <Text fontSize="sm" color="gray.600" mb={2}>
          Manage your payment method and billing settings by contacting our support team via
          WhatsApp.
        </Text>
        <ManagePaymentButton variant="outline" />
      </Box>

      {showDevTerminateButton && (
        <Box
          borderWidth={1}
          borderColor="red.200"
          p={4}
          backgroundColor="red.100"
          borderRadius="md"
          boxShadow="sm"
        >
          <Heading size="sm" mb={2} color="red.600">
            Danger Zone (Developer Only)
          </Heading>
          <Text fontSize="sm" color="red.600" mb={2}>
            This is meant for testing billing features and will immediately terminate your
            subscription.
          </Text>
          <Button colorScheme="red" isLoading={isTerminating} onClick={handleDevCancel} size="sm">
            {isTerminating ? "Terminating..." : "Terminate Subscription"}
          </Button>
        </Box>
      )}
    </VStack>
  );
}
