import {
  Text,
  Heading,
  UnorderedList,
  ListItem,
  Divider,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalBody,
  ModalCloseButton,
  Box,
  useBreakpointValue,
  VStack,
  HStack,
  Button,
  Spinner,
  Flex,
} from "@chakra-ui/react";
import { useState } from "react";
import PaywallPricingSection from "./PaywallPricingSection";
import PaywallOTPSection from "./PaywallOTPSection";
import { useRouter } from "next/router";
import { useAuth, useUser } from "@clerk/nextjs";
import posthog from "posthog-js";
import {
  getPrice,
  getPriceUnit,
  SubscriptionPlan,
  PaidSubscriptionPlan,
  isPlanPro,
  BillingPeriod,
  isPaidSubscriptionPlan,
  UpgradeKind,
  getBillingPeriod,
  formatPrice,
  getPayAsYouGoPriceId,
  getPayAsYouGoPackPrice,
} from "@/utils/price";
import { useUpgradePlan } from "@/hooks/useUpgradePlan";
import { revalidateCustomerDetails } from "@/revalidations/revalidateCustomerDetails";
import { safeCapture } from "@/utils/safePosthog";
import { getClientReferenceId } from "@/utils/getClientReferenceId";
import { UploadKind } from "@/uploadKind/uploadKind";
import { openWhatsAppChat } from "@/utils/whatsapp";

type Props = {
  tokensRequired?: number;
  currentBalance?: number;
  uploadKind?: UploadKind;
  isOpen: boolean;
  onClose: () => void;
  country?: string;
  transcriptId?: number | null;
  planName: SubscriptionPlan;
};

export default function PaywallHeader({
  tokensRequired,
  currentBalance,
  uploadKind,
  isOpen,
  onClose,
  country,
  transcriptId,
  planName,
}: Props) {
  const userBillingPeriod = getBillingPeriod(planName);

  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>(userBillingPeriod);
  const modalSize = useBreakpointValue({ base: "sm", md: "6xl", lg: "6xl" });
  const contentWidth = useBreakpointValue({ base: "full", md: "md" });
  const headingSize = useBreakpointValue({ base: "md", md: "lg" });
  const subHeadingSize = useBreakpointValue({ base: "xs", md: "sm" });
  const [selectedToken, setSelectedToken] = useState<number>(60);
  const paygSku = isPlanPro(planName) ? "Pro" : "Basic";
  const nearestPack = Math.max(60, Math.min(240, Math.round(selectedToken / 60) * 60)) as
    | 60
    | 120
    | 180
    | 240;
  const paygTotalPrice = getPayAsYouGoPackPrice(country ?? "US", paygSku, nearestPack);
  const pricePerCredit = paygTotalPrice / nearestPack;
  const baseline60Price = getPayAsYouGoPackPrice(country ?? "US", paygSku, 60);
  const baselinePerCredit = baseline60Price / 60;
  const savingsAmount = Math.max(0, (baselinePerCredit - pricePerCredit) * nearestPack);

  const padding = useBreakpointValue({ base: 3, md: 8 });
  const isMobile = useBreakpointValue({ base: true, md: false });

  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const [isLoading, setIsLoading] = useState(false);
  const [isOtpLoading, setIsOtpLoading] = useState(false);

  const openWhatsAppSupport = (message: string) => {
    openWhatsAppChat(message, "paywall");
  };

  const { upgradeKind, targetSubscriptionPlan, nextPlan, proratedData, upgradePlan } =
    useUpgradePlan(planName, billingPeriod, country);

  if (tokensRequired == null || currentBalance == null || uploadKind == null) {
    return null;
  }

  const handleOtp = async () => {
    const start = performance.now();
    try {
      setIsOtpLoading(true);
      posthog.capture("payg_button_click", { click_type: "payment", tokens: selectedToken });
      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priceId: getPayAsYouGoPriceId(country ?? "US", paygSku, nearestPack),
          clientReferenceId: getClientReferenceId(transcriptId, user?.id),
          quantity: 1,
          mode: "payment",
        }),
      }).then((r) => r.json());
      posthog.capture("payg_button_create_checkout", {
        duration: Math.round(performance.now() - start),
      });
      if (res.url) {
        router.push(res.url);
      }
    } finally {
      setIsOtpLoading(false);
    }
  };

  const handleSubscribe = async (plan: PaidSubscriptionPlan) => {
    const start = performance.now();
    if (!isLoaded || !isSignedIn) {
      posthog.capture("paywall_button_click", { click_type: "signup" });
      const price = getPrice(country, plan);
      router.push(`/sign-up?ph=${price}`);
      return;
    }

    setIsLoading(true);
    try {
      posthog.capture("paywall_button_click", { click_type: "payment" });

      if (planName === "Free") {
        const res = await fetch("/api/create-checkout-session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            plan,
            country: country ?? "ZA",
            clientReferenceId: getClientReferenceId(transcriptId, user?.id),
            quantity: 1,
            mode: "subscription",
          }),
        }).then((res) => res.json());

        posthog.capture("paywall_button_create_checkout", {
          duration: Math.round(performance.now() - start),
        });

        if (res.url) {
          router.push(res.url);
        }
      } else {
        await upgradePlan(plan);
        setTimeout(() => {
          revalidateCustomerDetails(transcriptId, user!.id);
        }, 5000);
        onClose();
      }
    } catch (error) {
      console.error("Failed to handle subscription:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const content =
    uploadKind === "audio" ? (
      <Box w="full">
        <Box>
          <Heading size={headingSize} fontWeight="extrabold" mb={3}>
            {isMobile ? "Let us write your minutes." : "Stop writing minutes."}
          </Heading>
          {!isMobile && (
            <Heading size={subHeadingSize} fontWeight="normal">
              Pay a little money to never worry about:
            </Heading>
          )}
        </Box>
        {isMobile ? (
          <Box p={3} borderRadius="lg" my={3}>
            <Text fontSize="sm">Save time and never worry about minutes again.</Text>
          </Box>
        ) : (
          <Box p={3} borderRadius="lg" mb={1}>
            <UnorderedList spacing={1} ml={4} color="gray.700" fontSize={{ base: "sm", md: "md" }}>
              <ListItem>Stressful nights and weekends writing minutes</ListItem>
              <ListItem>Leaving it until the last moment</ListItem>
              <ListItem>Listening to a recording over and over</ListItem>
              <ListItem>Forgetting to include important details</ListItem>
            </UnorderedList>
          </Box>
        )}
        <Divider my={3} />
        <Box bg="blue.50" p={3} borderRadius="lg">
          <Text fontSize={isMobile ? "sm" : "md"} fontWeight="normal" color="gray.700">
            This recording requires{" "}
            <Text as="span" fontWeight="extrabold" color="blue.600">
              {tokensRequired}
            </Text>{" "}
            tokens, but you only have{" "}
            <Text as="span" fontWeight="extrabold" color="blue.600">
              {currentBalance}
            </Text>{" "}
            token{currentBalance === 1 ? "" : "s"}.
          </Text>
        </Box>
      </Box>
    ) : uploadKind === "text" || uploadKind === "word" || uploadKind === "image" ? (
      <Box maxW={contentWidth}>
        <Box>
          <Heading size={headingSize} fontWeight="bold">
            {isMobile ? (
              "Get your minutes now"
            ) : (
              <>
                <Text as="span" textDecor="underline">
                  Purchase a plan
                </Text>{" "}
                to get your meeting minutes!
              </>
            )}
          </Heading>
        </Box>
        <Box bg="blue.50" p={3} borderRadius="lg" my={3}>
          <Text fontSize={isMobile ? "sm" : "md"} fontWeight="normal" color="gray.700">
            Generating minutes requires{" "}
            <Text as="span" fontWeight="extrabold" color="blue.600">
              {tokensRequired}
            </Text>{" "}
            tokens, but you only have{" "}
            <Text as="span" fontWeight="extrabold" color="blue.600">
              {currentBalance}
            </Text>{" "}
            token{currentBalance === 1 ? "" : "s"}.
          </Text>
        </Box>
        {isMobile ? (
          <Box bg="gray.50" p={3} borderRadius="lg" my={3}>
            <Text fontSize="sm" color="gray.700">
              The Basic plan gives you enough tokens for 6 transcripts per month.
            </Text>
          </Box>
        ) : (
          <>
            <Box>
              <Heading size={subHeadingSize} fontWeight="normal" color="gray.600">
                Purchase a plan below to get more tokens.
              </Heading>
            </Box>
            <Box bg="gray.50" p={3} borderRadius="lg" my={3}>
              <Heading size={subHeadingSize} fontWeight="normal" color="gray.700">
                Generating meeting minutes from a document always costs 50 tokens. The{" "}
                <Text as="span" fontWeight="semibold" color="blue.600">
                  Basic
                </Text>{" "}
                plan is perfect for this. It gives you enough tokens to upload 6 documents per
                month. (50 x 6 = 300 tokens, renewing monthly)
              </Heading>
            </Box>
            <Box>
              <Heading size={subHeadingSize} fontWeight="normal" color="gray.700">
                <Text as="span" fontWeight="semibold" textDecor="underline">
                  Buy back your time.
                </Text>{" "}
                Join thousands of professionals who rely on us to automate their meeting minutes.
              </Heading>
            </Box>
          </>
        )}
      </Box>
    ) : null;

  if (!content) {
    return null;
  }

  const planPrice =
    upgradeKind === UpgradeKind.Custom ? null : getPrice(country ?? "US", targetSubscriptionPlan!);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size={modalSize}
      isCentered
      motionPreset="slideInBottom"
      scrollBehavior="inside"
    >
      <ModalOverlay bg="blackAlpha.700" backdropFilter="blur(6px)" />
      <ModalContent
        bg="white"
        boxShadow="2xl"
        borderRadius="xl"
        mx={2}
        my={2}
        border="2px solid"
        borderColor="orange.300"
        sx={{
          animation: "pulse-border 2s ease-in-out infinite",
          "@keyframes pulse-border": {
            "0%, 100%": { borderColor: "var(--chakra-colors-orange-300)" },
            "50%": { borderColor: "var(--chakra-colors-orange-500)" },
          },
        }}
      >
        <ModalCloseButton size="sm" />
        <ModalBody py={padding} px={padding}>
          {isMobile ? (
            <VStack spacing={4} align="stretch">
              {content}
              <VStack spacing={0} align="stretch">
                <Box>
                  <PaywallPricingSection
                    currentPlan={planName}
                    requiredToken={tokensRequired}
                    country={country ?? "US"}
                    billingPeriod={billingPeriod}
                    onToggleBillingPeriod={setBillingPeriod}
                    showBillingToggle={!isPaidSubscriptionPlan(planName)}
                  />
                  <Flex flexDir="column" p={4} borderColor="gray.200" gap={3}>
                    {upgradeKind === UpgradeKind.Custom ? (
                      <Button
                        colorScheme="blue"
                        size="lg"
                        width="full"
                        onClick={() => {
                          onClose();
                          openWhatsAppSupport(
                            "Hi, I'm interested in upgrading to a custom plan. Can you help me?"
                          );
                        }}
                      >
                        Contact Support
                      </Button>
                    ) : (
                      <>
                        <Button
                          colorScheme="orange"
                          size="lg"
                          width="full"
                          onClick={() => handleSubscribe(targetSubscriptionPlan!)}
                          isLoading={isLoading}
                        >
                          Upgrade Now
                        </Button>
                        <Button
                          variant="solid"
                          size="lg"
                          width="full"
                          onClick={() => {
                            safeCapture("question_about_upgrade", {
                              country,
                              planName: nextPlan,
                            });
                            onClose();
                            openWhatsAppSupport("Hi, I have a question about upgrading: ");
                          }}
                        >
                          Ask a question
                        </Button>
                      </>
                    )}
                  </Flex>

                  <HStack>
                    <Divider />
                    <Text fontSize="xs" color="gray.400">
                      or
                    </Text>
                    <Divider />
                  </HStack>
                  {planName !== "Free" && (
                    <PaywallOTPSection
                      country={country ?? "US"}
                      selectedToken={selectedToken}
                      onChangeSelectedToken={(v) => setSelectedToken(v)}
                      paygTotalPrice={paygTotalPrice}
                      pricePerCredit={pricePerCredit}
                      savingsAmount={Math.max(
                        0,
                        (baselinePerCredit - pricePerCredit) * selectedToken
                      )}
                      isOtpLoading={isOtpLoading}
                      onOtp={handleOtp}
                    />
                  )}
                </Box>
              </VStack>
            </VStack>
          ) : (
            <HStack spacing={4} align="stretch">
              <VStack spacing={4} align="stretch">
                {content}
                <Box flex="1">
                  <PaywallPricingSection
                    currentPlan={planName}
                    requiredToken={tokensRequired}
                    country={country ?? "US"}
                    billingPeriod={billingPeriod}
                    onToggleBillingPeriod={setBillingPeriod}
                    showBillingToggle={!isPaidSubscriptionPlan(planName)}
                  />
                </Box>
              </VStack>
              <Box w="1px" bg="gray.200" />
              <Box w="500px" p={4}>
                <VStack spacing={4} align="stretch">
                  <Box>
                    {upgradeKind === UpgradeKind.Custom ? (
                      <VStack spacing={2} align="stretch">
                        <Text fontSize="md" fontWeight="semibold">
                          Chat with us.
                        </Text>
                        <Text fontSize="sm">
                          We&apos;ll help you find the perfect solution for your needs.
                        </Text>
                      </VStack>
                    ) : (
                      <VStack spacing={2} align="stretch">
                        <Text fontSize="lg" fontWeight="bold">
                          {planName === "Free" ? (
                            <>
                              You will pay {getPriceUnit(country ?? "US")}
                              {formatPrice(planPrice!)}
                              {billingPeriod === BillingPeriod.Yearly ? "/year" : "/month"}
                            </>
                          ) : proratedData != null ? (
                            <>
                              You will pay {getPriceUnit(country ?? "US")}
                              {formatPrice(Math.max(proratedData.proratedCost / 100, 0))}
                            </>
                          ) : (
                            <Spinner size="sm" />
                          )}
                        </Text>

                        <UnorderedList
                          spacing={1}
                          ml={4}
                          color="gray.700"
                          fontSize={{ base: "sm", md: "md" }}
                        >
                          <ListItem fontSize="md">Cancel anytime. Keep your tokens.</ListItem>
                          <ListItem fontSize="md">
                            You will get {nextPlan && isPlanPro(nextPlan) ? "1200" : "300"} tokens
                            per {nextPlan?.includes("Annual") ? "year" : "month"}.
                          </ListItem>
                          <ListItem fontSize="md">14 day money back guarantee.</ListItem>
                        </UnorderedList>
                      </VStack>
                    )}
                  </Box>
                  {upgradeKind === UpgradeKind.Custom ? (
                    <Button
                      colorScheme="blue"
                      size="lg"
                      width="full"
                      onClick={() => {
                        onClose();
                        openWhatsAppSupport(
                          "Hi, I'm interested in upgrading to a custom plan. Can you help me?"
                        );
                      }}
                    >
                      Contact Support
                    </Button>
                  ) : (
                    <Flex flexDir="column" gap={3}>
                      <Button
                        colorScheme="orange"
                        size="lg"
                        width="full"
                        onClick={() => handleSubscribe(targetSubscriptionPlan!)}
                        isLoading={isLoading}
                      >
                        Upgrade Now
                      </Button>
                      <Button
                        variant="solid"
                        size="lg"
                        width="full"
                        onClick={() => {
                          safeCapture("question_about_upgrade", {
                            country,
                            planName: nextPlan,
                          });
                          onClose();
                          openWhatsAppSupport("Hi, I have a question about upgrading: ");
                        }}
                      >
                        Ask a question
                      </Button>
                    </Flex>
                  )}
                  {planName !== "Free" && (
                    <Box>
                      <VStack spacing={4} align="stretch">
                        <HStack>
                          <Divider />
                          <Text fontSize="xs" color="gray.400">
                            or
                          </Text>
                          <Divider />
                        </HStack>
                        <PaywallOTPSection
                          country={country ?? "US"}
                          selectedToken={selectedToken}
                          onChangeSelectedToken={(v) => setSelectedToken(v)}
                          paygTotalPrice={paygTotalPrice}
                          pricePerCredit={pricePerCredit}
                          savingsAmount={Math.max(
                            0,
                            (baselinePerCredit - pricePerCredit) * selectedToken
                          )}
                          isOtpLoading={isOtpLoading}
                          onOtp={handleOtp}
                          containerProps={{ mt: 0, p: 0, borderWidth: 0, bg: "transparent" }}
                        />
                      </VStack>
                    </Box>
                  )}
                </VStack>
              </Box>
            </HStack>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
