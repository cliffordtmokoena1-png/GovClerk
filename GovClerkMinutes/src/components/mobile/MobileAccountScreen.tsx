import React from "react";
import {
  Box,
  Flex,
  Text,
  Skeleton,
  Tooltip,
  Alert,
  AlertIcon,
  AlertDescription,
} from "@chakra-ui/react";
import {
  HiCog6Tooth,
  HiQuestionMarkCircle,
  HiArrowRightOnRectangle,
  HiChatBubbleLeftRight,
  HiShieldCheck,
  HiCalendar,
  HiGlobeAlt,
} from "react-icons/hi2";
import { BsQuestionCircle } from "react-icons/bs";
import { useRouter } from "next/router";
import { useClerk, useSession, OrganizationSwitcher, useOrganization } from "@clerk/nextjs";
import useSWR from "swr";
import { isDev } from "@/utils/dev";
import { ApiGetCustomerDetailsResponse } from "@/pages/api/get-customer-details";
import { getPrettyPlanName, isPlanBasic, isPlanPro } from "@/utils/price";
import Icon from "../Icon";
import { BOTTOM_BAR_HEIGHT_PX } from "../BottomBar";
import { openWhatsAppChat } from "@/utils/whatsapp";

type Props = {
  onOpen?: (modalType: "pricing" | "upgrade" | "referral") => void;
};

const fetcher = (url: string) => fetch(url, { method: "POST" }).then((res) => res.json());

export default function MobileAccountScreen({ onOpen }: Props) {
  const router = useRouter();
  const { signOut } = useClerk();
  const { session, isLoaded } = useSession();
  const { organization } = useOrganization();
  const isAdmin = isLoaded && session?.user?.publicMetadata?.role === "admin";
  const isEnterprise =
    isLoaded && (session?.user?.publicMetadata?.isEnterprise as boolean | undefined);
  const { data: customerDetails, isLoading: isLoadingCustomer } =
    useSWR<ApiGetCustomerDetailsResponse>("/api/get-customer-details", fetcher);
  const { data: tokenData, isLoading: isLoadingToken } = useSWR<{ tokens: number }>(
    "/api/get-tokens",
    fetcher
  );

  const plan =
    customerDetails?.subscriptionStatus === "cancel_at_period_end"
      ? getPrettyPlanName("Free")
      : getPrettyPlanName(customerDetails?.planName);

  const handleUpgradeClick = () => {
    if (!customerDetails) {
      return;
    }

    if (customerDetails.subscriptionStatus !== "active") {
      onOpen?.("pricing");
    } else if (isPlanBasic(customerDetails.planName)) {
      onOpen?.("upgrade");
    } else if (isPlanPro(customerDetails.planName)) {
      onOpen?.("referral");
    } else {
      onOpen?.("pricing");
    }
  };

  const handleSettingsClick = () => {
    router.push("/profile");
  };

  const handleAdminClick = () => {
    router.push("/admin");
  };

  const handleAgendasClick = () => {
    router.push("/agendas");
  };

  const handleHelpCenterClick = () => {
    window.open("https://help.GovClerkMinutes.com/", "_blank");
  };

  const handleChatWithUsClick = () => {
    const email = session?.user?.primaryEmailAddress?.emailAddress;
    const parts = ["Hi, I need help with GovClerk."];
    if (email) parts.push(`My email: ${email}`);
    if (plan) parts.push(`Plan: ${plan}`);
    openWhatsAppChat(parts.join("\n"), "mobile_account_screen");
  };

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  const isLoading = isLoadingCustomer || isLoadingToken;

  return (
    <Flex direction="column" h="100%" w="100%" bg="white" overflow="hidden">
      <Flex
        flexShrink={0}
        bg="white"
        borderBottom="1px solid"
        borderColor="gray.100"
        px={4}
        py={2}
        alignItems="center"
        justifyContent="space-between"
        minH="48px"
      >
        <Flex alignItems="center" gap={2.5} minW={0}>
          <Box w="20px" h="20px" flexShrink={0}>
            <Icon />
          </Box>
          <Text fontSize="md" fontWeight="medium" color="gray.700" isTruncated>
            Account
          </Text>
        </Flex>
      </Flex>

      <Flex
        flexDir="column"
        overflowY="auto"
        overflowX="hidden"
        flex={1}
        minH={0}
        w="100%"
        bg="white"
      >
        {isLoading ? (
          <Box px={4} pt={4}>
            <Skeleton height="120px" mb={3} borderRadius="lg" />
            <Skeleton height="50px" mb={3} borderRadius="lg" />
            <Skeleton height="160px" borderRadius="lg" />
          </Box>
        ) : (
          <Box px={4} pt={4} pb={`${BOTTOM_BAR_HEIGHT_PX + 20}px`}>
            <Box
              bg="gray.50"
              borderRadius="lg"
              p={4}
              mb={3}
              border="1px solid"
              borderColor="gray.200"
            >
              <Flex alignItems="center" justifyContent="space-between" mb={3}>
                <Text
                  fontSize="xs"
                  fontWeight="semibold"
                  color="gray.500"
                  textTransform="uppercase"
                  letterSpacing="wide"
                >
                  Tokens
                </Text>
                <Flex alignItems="center" gap={1.5}>
                  <Text
                    fontSize="xl"
                    fontWeight="bold"
                    color={(tokenData?.tokens ?? 0) > 0 ? "green.600" : "red.500"}
                  >
                    {tokenData?.tokens ?? 0}
                  </Text>
                  <Tooltip
                    label={`You can transcribe up to ${tokenData?.tokens ?? 0} minutes of recorded meetings`}
                    fontSize="xs"
                  >
                    <span>
                      <BsQuestionCircle size={14} color="#A0AEC0" />
                    </span>
                  </Tooltip>
                </Flex>
              </Flex>
              <Flex alignItems="center" justifyContent="space-between">
                <Text
                  fontSize="xs"
                  fontWeight="semibold"
                  color="gray.500"
                  textTransform="uppercase"
                  letterSpacing="wide"
                >
                  Plan
                </Text>
                <Text fontSize="md" fontWeight="semibold" color="gray.900">
                  {plan}
                </Text>
              </Flex>
              {(tokenData?.tokens ?? 0) <= 0 && (
                <Alert status="warning" borderRadius="md" py={2} px={3} mt={3}>
                  <AlertIcon boxSize={4} />
                  <AlertDescription fontSize="xs" lineHeight="short">
                    You&apos;ve used all your tokens.{" "}
                    <Text
                      as="span"
                      textDecor="underline"
                      cursor="pointer"
                      onClick={() => onOpen?.("pricing")}
                    >
                      Upgrade to continue.
                    </Text>
                  </AlertDescription>
                </Alert>
              )}
            </Box>

            {!isEnterprise && (
              <Box
                as="button"
                w="full"
                bg="blue.500"
                color="white"
                borderRadius="lg"
                p={4}
                mb={3}
                boxShadow="sm"
                _active={{ bg: "blue.600" }}
                onClick={handleUpgradeClick}
              >
                <Text fontSize="md" fontWeight="semibold">
                  {customerDetails?.subscriptionStatus === "active" &&
                  isPlanPro(customerDetails?.planName)
                    ? "Refer a friend"
                    : "Upgrade your plan"}
                </Text>
              </Box>
            )}

            {isDev() && (
              <Box
                bg="gray.50"
                borderRadius="lg"
                p={4}
                mb={3}
                border="1px solid"
                borderColor="gray.200"
              >
                <Text
                  fontSize="xs"
                  fontWeight="semibold"
                  color="gray.500"
                  textTransform="uppercase"
                  letterSpacing="wide"
                  mb={3}
                >
                  Organization
                </Text>
                <Flex w="full" justifyContent="flex-start">
                  <OrganizationSwitcher
                    createOrganizationUrl="/org/signup"
                    afterCreateOrganizationUrl="/dashboard"
                    afterSelectOrganizationUrl="/dashboard"
                    hidePersonal={false}
                    appearance={{
                      elements: {
                        rootBox: {
                          width: "100%",
                        },
                        organizationSwitcherTrigger: {
                          width: "100%",
                          justifyContent: "flex-start",
                        },
                      },
                    }}
                  />
                </Flex>
              </Box>
            )}

            <Box
              bg="gray.50"
              borderRadius="lg"
              overflow="hidden"
              border="1px solid"
              borderColor="gray.200"
            >
              {isAdmin && (
                <Flex
                  as="button"
                  w="full"
                  py={4}
                  px={4}
                  alignItems="center"
                  justifyContent="space-between"
                  borderBottom="1px solid"
                  borderColor="gray.100"
                  _active={{ bg: "gray.50" }}
                  onClick={handleAdminClick}
                >
                  <Flex alignItems="center" gap={3}>
                    <HiShieldCheck size={20} color="#9F7AEA" />
                    <Text fontSize="md" fontWeight="medium" color="purple.400">
                      Admin
                    </Text>
                  </Flex>
                  <Text fontSize="lg" color="purple.400">
                    ›
                  </Text>
                </Flex>
              )}
              <Flex
                as="button"
                w="full"
                py={4}
                px={4}
                alignItems="center"
                justifyContent="space-between"
                borderBottom="1px solid"
                borderColor="gray.100"
                _active={{ bg: "gray.50" }}
                onClick={handleAgendasClick}
              >
                <Flex alignItems="center" gap={3}>
                  <HiCalendar size={20} color="#805AD5" />
                  <Text fontSize="md" fontWeight="medium" color="gray.900">
                    Agendas
                  </Text>
                </Flex>
                <Text fontSize="lg" color="gray.400">
                  ›
                </Text>
              </Flex>

              <Flex
                as="button"
                w="full"
                py={4}
                px={4}
                alignItems="center"
                justifyContent="space-between"
                borderBottom="1px solid"
                borderColor="gray.100"
                _active={{ bg: "gray.50" }}
                onClick={handleSettingsClick}
              >
                <Flex alignItems="center" gap={3}>
                  <HiCog6Tooth size={20} color="#4A5568" />
                  <Text fontSize="md" fontWeight="medium" color="gray.900">
                    Settings
                  </Text>
                </Flex>
                <Text fontSize="lg" color="gray.400">
                  ›
                </Text>
              </Flex>

              <Flex
                as="button"
                w="full"
                py={4}
                px={4}
                alignItems="center"
                justifyContent="space-between"
                borderBottom="1px solid"
                borderColor="gray.100"
                _active={{ bg: "gray.50" }}
                onClick={handleHelpCenterClick}
              >
                <Flex alignItems="center" gap={3}>
                  <HiQuestionMarkCircle size={20} color="#4A5568" />
                  <Text fontSize="md" fontWeight="medium" color="gray.900">
                    Help Center
                  </Text>
                </Flex>
                <Text fontSize="lg" color="gray.400">
                  ›
                </Text>
              </Flex>

              <Flex
                as="button"
                w="full"
                py={4}
                px={4}
                alignItems="center"
                justifyContent="space-between"
                borderBottom="1px solid"
                borderColor="gray.100"
                _active={{ bg: "gray.50" }}
                onClick={handleChatWithUsClick}
              >
                <Flex alignItems="center" gap={3}>
                  <HiChatBubbleLeftRight size={20} color="#4A5568" />
                  <Text fontSize="md" fontWeight="medium" color="gray.900">
                    Chat with us
                  </Text>
                </Flex>
                <Text fontSize="lg" color="gray.400">
                  ›
                </Text>
              </Flex>

              <Flex
                as="button"
                w="full"
                py={4}
                px={4}
                alignItems="center"
                justifyContent="space-between"
                _active={{ bg: "gray.50" }}
                onClick={handleSignOut}
              >
                <Flex alignItems="center" gap={3}>
                  <HiArrowRightOnRectangle size={20} color="#E53E3E" />
                  <Text fontSize="md" fontWeight="medium" color="red.600">
                    Sign Out
                  </Text>
                </Flex>
              </Flex>
            </Box>
          </Box>
        )}
      </Flex>
    </Flex>
  );
}
