import React from "react";
import {
  Box,
  Text,
  Button,
  Progress,
  Flex,
  HStack,
  Tooltip,
  Icon,
  VStack,
  Link,
} from "@chakra-ui/react";
import { MdHelpOutline } from "react-icons/md";
import NextLink from "next/link";
import { ApiGetCustomerDetailsResponse } from "@/pages/api/get-customer-details";

interface UsageDetailsProps {
  subscriptionData: ApiGetCustomerDetailsResponse;
  subscriptionPaused: boolean;
  subscriptionCanceled: boolean;
  isFreeUser: boolean;
  currentUsage: number;
  tokenUsagePercentage: number;
  excessToken: number;
  hasExcessToken: boolean;
  daysUntilReset: number;
  isLoadingCreditDetails: boolean;
  fetchCreditDetails: () => void;
}

export default function UsageDetails({
  subscriptionData,
  subscriptionPaused,
  subscriptionCanceled,
  isFreeUser,
  currentUsage,
  tokenUsagePercentage,
  excessToken,
  hasExcessToken,
  daysUntilReset,
  isLoadingCreditDetails,
  fetchCreditDetails,
}: UsageDetailsProps) {
  return (
    <VStack align="stretch" spacing={4}>
      {!isFreeUser && !subscriptionPaused && !subscriptionCanceled && (
        <Text fontSize="sm" color="gray.600">
          Your token usage will reset in{" "}
          <strong>
            {daysUntilReset} day{daysUntilReset > 1 && "s"}
          </strong>
          .
        </Text>
      )}

      <Box borderWidth={1} borderColor="gray.200" p={4} borderRadius="md" boxShadow="sm">
        <Text fontSize="sm" color="gray.600" mb={4}>
          You can transcribe up to <strong>{subscriptionData.remainingToken} minutes</strong> of
          media.
        </Text>

        {hasExcessToken && (
          <Box mb={4}>
            <Flex justify="space-between" align="center" mb={2}>
              <HStack>
                <Text fontSize="sm" fontWeight="bold">
                  One-Time Tokens
                </Text>
                <Tooltip label="One-Time tokens will be used first before your plan tokens">
                  <span>
                    <Icon as={MdHelpOutline} boxSize={4} color="gray.500" />
                  </span>
                </Tooltip>
              </HStack>
              <Text fontSize="sm">{excessToken}</Text>
            </Flex>
            <Progress value={100} colorScheme="purple" size="sm" borderRadius="md" />
          </Box>
        )}

        <Flex justify="space-between" align="center" mb={2}>
          <Text fontSize="sm" fontWeight="bold">
            {isFreeUser
              ? "Trial Plan"
              : subscriptionPaused || subscriptionCanceled
                ? "Previous"
                : "Current"}{" "}
            Plan
          </Text>
          <Text fontSize="sm">
            {isFreeUser
              ? `${subscriptionData.remainingToken} of ${subscriptionData.tokensPerMonth} tokens remaining`
              : `${currentUsage} of ${subscriptionData.tokensPerMonth} used`}
          </Text>
        </Flex>
        {(() => {
          const trialTokensUsedPercentage =
            subscriptionData.tokensPerMonth > 0
              ? Math.max(
                  0,
                  Math.min(
                    100,
                    ((subscriptionData.tokensPerMonth - subscriptionData.remainingToken) /
                      subscriptionData.tokensPerMonth) *
                      100
                  )
                )
              : 0;
          return (
            <Progress
              value={isFreeUser ? trialTokensUsedPercentage : tokenUsagePercentage}
              colorScheme={isFreeUser ? "orange" : "green"}
              size="sm"
              borderRadius="md"
            />
          );
        })()}

        {isFreeUser && (
          <Text fontSize="sm" color="gray.600" mt={3}>
            Need more tokens?{" "}
            <NextLink href="/dashboard" passHref>
              <Link color="blue.500">Upgrade to a paid plan</Link>
            </NextLink>{" "}
            for more minutes.
          </Text>
        )}

        <Button
          mt={4}
          size="sm"
          variant="outline"
          onClick={fetchCreditDetails}
          isLoading={isLoadingCreditDetails}
          loadingText="Generating detailed report..."
        >
          View Detailed Token Usage
        </Button>
      </Box>
    </VStack>
  );
}
