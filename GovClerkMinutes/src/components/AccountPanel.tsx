import {
  Button,
  Flex,
  Text,
  Tooltip,
  Skeleton,
  Alert,
  AlertIcon,
  AlertDescription,
  Progress,
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
  const tokensPerMonth = customerDetails?.tokensPerMonth ?? 30;
  const tokenPercentage = Math.min(100, Math.max(0, (tokenCount / tokensPerMonth) * 100));

  const getTokenColorScheme = () => {
    if (tokenCount <= 0 || tokenPercentage < 20) return "red";
    if (tokenPercentage < 50) return "yellow";
    return "blue";
  };

  const getTokenCountColor = () => {
    if (tokenCount <= 0 || tokenPercentage < 20) return "red.500";
    return "gray.700";
  };
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
      <Flex w="full" flexDirection="column" gap={1.5}>
        {tokenData != null ? (
          <>
            <Flex alignItems="center" justifyContent="space-between">
              <Flex alignItems="center" gap={1}>
                <Text fontSize="xs" fontWeight="semibold" color="gray.600">
                  Tokens
                </Text>
                <Tooltip
                  label={`You can transcribe up to ${tokenCount} minutes of recorded meetings`}
                  fontSize="md"
                >
                  <span>
                    <BsQuestionCircle size={11} />
                  </span>
                </Tooltip>
              </Flex>
              <Text
                fontSize="xs"
                fontWeight="bold"
                color={getTokenCountColor()}
              >
                {tokenCount} / {tokensPerMonth}
              </Text>
            </Flex>
            <Progress
              value={tokenPercentage}
              size="sm"
              borderRadius="full"
              colorScheme={getTokenColorScheme()}
              hasStripe
              isAnimated
              bg="gray.200"
            />
            <Flex alignItems="center" gap={1}>
              <Text fontSize="xs" color="gray.500">
                Plan:
              </Text>
              <Text fontSize="xs" color="gray.700" fontWeight="medium">
                {plan || getPrettyPlanName("Free")}
              </Text>
            </Flex>
          </>
        ) : (
          <>
            <Flex alignItems="center" justifyContent="space-between">
              <Skeleton height="12px" width="50px" />
              <Skeleton height="12px" width="40px" />
            </Flex>
            <Skeleton height="8px" width="full" borderRadius="full" />
            <Skeleton height="12px" width="60px" />
          </>
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
