import {
  Button,
  Flex,
  Text,
  Tooltip,
  Skeleton,
  Alert,
  AlertIcon,
  AlertDescription,
} from "@chakra-ui/react";
import { BsQuestionCircle } from "react-icons/bs";
import { LayoutKind, ModalType } from "@/pages/dashboard/[[...slug]]";
import { ApiGetCustomerDetailsResponse } from "@/pages/api/get-customer-details";
import { useSession } from "@clerk/nextjs";
import { getPrettyPlanName, isPlanBasic, isPlanPro } from "@/utils/price";

type AccountPanelProps = {
  layoutKind: LayoutKind;
  customerDetails?: ApiGetCustomerDetailsResponse;
  tokenData?: { tokens: number | null };
  onOpen: (modalType: ModalType) => void;
};

const AccountPanel = ({ layoutKind, customerDetails, tokenData, onOpen }: AccountPanelProps) => {
  const { session, isLoaded } = useSession();

  const plan =
    customerDetails?.subscriptionStatus === "cancel_at_period_end"
      ? getPrettyPlanName("Free")
      : getPrettyPlanName(customerDetails?.planName);
  const tokenCount = tokenData?.tokens ?? 0;
  return (
    <Flex
      bg="gray.50"
      borderTopColor="gray.200"
      borderTopWidth="1px"
      py="4"
      px="4"
      flexDir="column"
      justifyContent="end"
      gap={3}
    >
      {layoutKind === "desktop" && (
        <>
          {customerDetails == null ||
          !isLoaded ||
          session?.user?.publicMetadata?.isEnterprise ? null : (
            <Button
              variant="outline"
              colorScheme="blue"
              borderColor="blue.700"
              color="blue.700"
              size="sm"
              overflow="hidden"
              w="full"
              onClick={() => {
                if (customerDetails.subscriptionStatus !== "active") {
                  onOpen("pricing");
                } else if (isPlanBasic(customerDetails.planName)) {
                  onOpen("upgrade");
                } else if (isPlanPro(customerDetails.planName)) {
                  onOpen("referral");
                } else {
                  onOpen("pricing");
                }
              }}
            >
              {customerDetails.subscriptionStatus === "active" &&
              isPlanPro(customerDetails.planName)
                ? "Refer a friend"
                : "Upgrade your plan"}
            </Button>
          )}
        </>
      )}
      <Flex w="full" alignItems="center">
        {tokenData != null ? (
          <Flex flexDirection="column">
            <Flex alignItems="center" gap={1}>
              <Text fontSize="sm" fontWeight="semibold">
                Tokens:
              </Text>
              <Text
                fontSize="sm"
                fontWeight="bold"
                color={tokenCount > 0 ? "green.600" : "red.500"}
              >
                {tokenCount}
              </Text>
              <Flex alignItems="center" ml={1}>
                <Tooltip
                  label={`You can transcribe up to ${tokenCount} minutes of recorded meetings`}
                  fontSize="md"
                >
                  <span>
                    <BsQuestionCircle size={13} />
                  </span>
                </Tooltip>
              </Flex>
            </Flex>
            <Flex alignItems="center" gap={1}>
              <Text fontSize="sm" fontWeight="semibold">
                Plan:
              </Text>
              <Text fontSize="sm">{plan || getPrettyPlanName("Free")}</Text>
            </Flex>
          </Flex>
        ) : (
          <Flex flexDirection="column">
            <Flex alignItems="center" gap={1}>
              <Text fontSize="sm" fontWeight="semibold">
                Tokens:
              </Text>
              <Skeleton height="14px" width="30px" />
            </Flex>
            <Flex alignItems="center" gap={1}>
              <Text fontSize="sm" fontWeight="semibold">
                Plan:
              </Text>
              <Skeleton height="14px" width="40px" />
            </Flex>
          </Flex>
        )}
      </Flex>
      {tokenData != null && tokenCount <= 0 && (
        <Alert status="warning" borderRadius="md" py={2} px={3} mt={1}>
          <AlertIcon boxSize={4} />
          <AlertDescription fontSize="xs" lineHeight="short">
            You&apos;ve used all your tokens.{" "}
            <Text
              as="span"
              textDecor="underline"
              cursor="pointer"
              onClick={() => onOpen("pricing")}
            >
              Upgrade to continue.
            </Text>
          </AlertDescription>
        </Alert>
      )}
    </Flex>
  );
};

export default AccountPanel;
