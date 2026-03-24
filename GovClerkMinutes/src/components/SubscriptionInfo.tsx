import React from "react";
import {
  Box,
  Flex,
  HStack,
  VStack,
  Icon,
  Heading,
  Text,
  Button,
  Alert,
  AlertIcon,
  Badge,
} from "@chakra-ui/react";
import { MdStars } from "react-icons/md";
import { ApiGetCustomerDetailsResponse } from "@/pages/api/get-customer-details";
import { getPrettyPlanName, SubscriptionPlan, formatPrice } from "@/utils/price";
import ManagePaymentButton from "./ManagePaymentButton";

interface SubscriptionInfoProps {
  subscriptionData: ApiGetCustomerDetailsResponse;
  subscriptionActive: boolean;
  subscriptionPaused: boolean;
  subscriptionCanceled: boolean;
  subscriptionDelinquent: boolean;
  isFreeUser: boolean;
  planName: SubscriptionPlan;
  price: number;
  priceUnit: string;
  isRenewing: boolean;
  handlePauseClick: () => void;
  handleResubscribeClick: () => void;
  billingContext?: {
    type: "personal" | "organization";
    orgName?: string;
  };
}

export default function SubscriptionInfo({
  subscriptionData,
  subscriptionActive,
  subscriptionPaused,
  subscriptionCanceled,
  subscriptionDelinquent,
  isFreeUser,
  planName,
  price,
  priceUnit,
  isRenewing,
  handlePauseClick,
  handleResubscribeClick,
  billingContext,
}: SubscriptionInfoProps) {
  const prettyInterval = subscriptionData.interval === "year" ? "Year" : "Month";
  const prettyPrice = isFreeUser ? "Free" : `${priceUnit}${formatPrice(price)} / ${prettyInterval}`;

  if (subscriptionData.billingModel === "contract") {
    return (
      <Alert status="info" borderRadius="md">
        <AlertIcon />
        <Text fontSize="sm">
          Your organization is on a contract billing model. For billing inquiries, please contact
          your account manager.
        </Text>
        <Text fontSize="sm">
          The last billing date was <strong>{subscriptionData.nextBillDate}</strong>
        </Text>
      </Alert>
    );
  }

  return (
    <>
      {subscriptionDelinquent && (
        <Alert
          status="error"
          borderRadius="md"
          mb={4}
          flexDirection="column"
          alignItems="start"
          gap={2}
        >
          <Flex>
            <AlertIcon />
            <Text fontSize="sm">
              Your payment is past due. Please update your payment information or your service will
              be canceled.
            </Text>
          </Flex>
          <Flex gap={2} pl={8}>
            <ManagePaymentButton variant="solid" />
            <Button variant="solid" size="sm" onClick={handlePauseClick}>
              Pause Subscription
            </Button>
          </Flex>
        </Alert>
      )}

      {subscriptionPaused && (
        <Alert status="warning" borderRadius="md">
          <AlertIcon />
          <Text fontSize="sm">
            Your subscription has been paused and will be canceled on{" "}
            <strong>{subscriptionData.nextBillDate}</strong>
          </Text>
        </Alert>
      )}

      {(subscriptionCanceled || isFreeUser) && (
        <>
          <Alert status="info" borderRadius="md">
            <AlertIcon />
            <Text fontSize="sm">You are on the Free plan of GovClerkMinutes.</Text>
          </Alert>
        </>
      )}

      {!isFreeUser && (subscriptionActive || subscriptionPaused) && (
        <Box borderWidth={1} borderColor="gray.200" p={4} borderRadius="md" boxShadow="sm">
          <Flex align="center" justify="space-between" mb={3}>
            <HStack spacing={3}>
              <Icon as={MdStars} boxSize={6} color="purple.500" />
              <VStack align="start" spacing={0}>
                <HStack>
                  <Heading size="md">GovClerkMinutes {getPrettyPlanName(planName)}</Heading>
                  {billingContext && (
                    <Badge colorScheme={billingContext.type === "organization" ? "purple" : "blue"}>
                      {billingContext.type === "organization"
                        ? billingContext.orgName || "Organization"
                        : "Personal"}
                    </Badge>
                  )}
                </HStack>
                <Text fontSize="sm" fontWeight="bold" color="gray.600">
                  {prettyPrice}
                </Text>
              </VStack>
            </HStack>
            <HStack>
              <Button
                colorScheme={subscriptionActive ? "red" : "green"}
                variant="outline"
                size="sm"
                onClick={subscriptionActive ? handlePauseClick : handleResubscribeClick}
                isLoading={isRenewing}
                loadingText={
                  subscriptionActive
                    ? "Pausing..."
                    : subscriptionCanceled || isFreeUser
                      ? "Subscribing..."
                      : "Renewing..."
                }
                isDisabled={!subscriptionActive && !subscriptionPaused && !subscriptionCanceled}
              >
                {subscriptionActive ? "Pause" : subscriptionCanceled ? "Resubscribe" : "Renew"}
              </Button>
            </HStack>
          </Flex>
          <Text fontSize="sm" color="gray.600" mb={4}>
            {subscriptionCanceled
              ? `By subscribing, you'll get premium features, ${subscriptionData.tokensPerMonth} tokens per month, and additional benefits.`
              : `You have premium features, ${subscriptionData.tokensPerMonth} tokens per month, and additional benefits.`}
          </Text>
        </Box>
      )}
    </>
  );
}
