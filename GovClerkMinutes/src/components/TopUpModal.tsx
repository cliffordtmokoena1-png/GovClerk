import { useState } from "react";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  Button,
  Flex,
  Text,
  Box,
  VStack,
  Alert,
  AlertIcon,
  AlertDescription,
  Spinner,
  Badge,
} from "@chakra-ui/react";
import { useUser } from "@clerk/nextjs";
import { getPrettyPlanName, getPrice, getPriceUnit, formatPrice } from "@/utils/price";
import { ApiGetCustomerDetailsResponse } from "@/pages/api/get-customer-details";
import { getClientReferenceId } from "@/utils/getClientReferenceId";

type TopUpModalProps = {
  isOpen: boolean;
  onClose: () => void;
  customerDetails: ApiGetCustomerDetailsResponse;
  country: string | null;
  onOpenPricing: () => void;
};

type PlanChoice = "current" | "switch" | null;
type Step = "choose" | "confirm";

export default function TopUpModal({
  isOpen,
  onClose,
  customerDetails,
  country,
  onOpenPricing,
}: TopUpModalProps) {
  const { user } = useUser();
  const [selected, setSelected] = useState<PlanChoice>(null);
  const [step, setStep] = useState<Step>("choose");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const planName = customerDetails.planName;
  const isFreeUser = customerDetails.isFreeUser || planName === "Free";
  const prettyPlan = getPrettyPlanName(planName);
  const price = getPrice(country, planName);
  const priceUnit = getPriceUnit(country);
  const formattedPrice = `${priceUnit}${formatPrice(price)}`;

  const handleClose = () => {
    setSelected(null);
    setStep("choose");
    setError(null);
    onClose();
  };

  const handleConfirmChoice = () => {
    if (selected === "switch") {
      handleClose();
      onOpenPricing();
      return;
    }
    setStep("confirm");
  };

  const handlePay = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const clientReferenceId = getClientReferenceId(null, user?.id);
      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: planName,
          country: country ?? undefined,
          clientReferenceId,
          mode: "subscription",
          topUp: true,
        }),
      }).then((r) => r.json());

      if (res.url) {
        window.location.href = res.url;
      } else {
        throw new Error(res.error ?? "No checkout URL returned");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    setStep("choose");
    setError(null);
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} isCentered size="md">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader borderBottomWidth="1px" borderColor="gray.100" pb={3}>
          <Flex alignItems="center" gap={2}>
            <span>⚡</span>
            <Text>Top Up Tokens</Text>
          </Flex>
        </ModalHeader>
        <ModalCloseButton />

        {step === "choose" ? (
          <>
            <ModalBody py={5}>
              <Text fontSize="sm" color="gray.600" mb={4}>
                Choose how you want to top up your tokens:
              </Text>
              <VStack spacing={3} align="stretch">
                {!isFreeUser && (
                  <Box
                    border="2px solid"
                    borderColor={selected === "current" ? "blue.500" : "gray.200"}
                    bg={selected === "current" ? "blue.50" : "white"}
                    borderRadius="lg"
                    p={4}
                    cursor="pointer"
                    onClick={() => setSelected("current")}
                    transition="all 0.15s"
                    _hover={{ borderColor: "blue.400" }}
                  >
                    <Flex justifyContent="space-between" alignItems="flex-start">
                      <Box>
                        <Text fontWeight="semibold" fontSize="sm" color="gray.800">
                          Keep My Current Plan
                        </Text>
                        <Text fontSize="xs" color="gray.500" mt={0.5}>
                          Top up now and restart your billing cycle with the same plan
                        </Text>
                      </Box>
                      <Badge colorScheme="blue" ml={2} flexShrink={0}>
                        {prettyPlan} — {formattedPrice}
                      </Badge>
                    </Flex>
                  </Box>
                )}

                <Box
                  border="2px solid"
                  borderColor={selected === "switch" ? "blue.500" : "gray.200"}
                  bg={selected === "switch" ? "blue.50" : "white"}
                  borderRadius="lg"
                  p={4}
                  cursor="pointer"
                  onClick={() => setSelected("switch")}
                  transition="all 0.15s"
                  _hover={{ borderColor: "blue.400" }}
                >
                  <Text fontWeight="semibold" fontSize="sm" color="gray.800">
                    Switch to a New Plan
                  </Text>
                  <Text fontSize="xs" color="gray.500" mt={0.5}>
                    Browse available plans and choose a different tier
                  </Text>
                </Box>
              </VStack>
            </ModalBody>
            <ModalFooter borderTopWidth="1px" borderColor="gray.100" pt={3}>
              <Button variant="ghost" size="sm" mr={3} onClick={handleClose}>
                Cancel
              </Button>
              <Button
                colorScheme="green"
                size="sm"
                isDisabled={selected === null}
                onClick={handleConfirmChoice}
              >
                Confirm Top-Up
              </Button>
            </ModalFooter>
          </>
        ) : (
          <>
            <ModalBody py={5}>
              <VStack spacing={4} align="stretch">
                <Box
                  bg="blue.50"
                  border="1px solid"
                  borderColor="blue.100"
                  borderRadius="lg"
                  p={4}
                >
                  <Text fontSize="sm" color="gray.700" lineHeight="tall">
                    You&apos;ll be charged{" "}
                    <Text as="span" fontWeight="bold" color="blue.700">
                      {formattedPrice}
                    </Text>{" "}
                    for the{" "}
                    <Text as="span" fontWeight="bold" color="blue.700">
                      {prettyPlan}
                    </Text>{" "}
                    plan and your billing cycle will restart today.
                  </Text>
                  <Text fontSize="xs" color="gray.500" mt={2}>
                    Your next scheduled charge will be skipped.
                  </Text>
                </Box>

                {error && (
                  <Alert status="error" borderRadius="md">
                    <AlertIcon />
                    <AlertDescription fontSize="xs">{error}</AlertDescription>
                  </Alert>
                )}
              </VStack>
            </ModalBody>
            <ModalFooter borderTopWidth="1px" borderColor="gray.100" pt={3}>
              <Button variant="ghost" size="sm" mr={3} onClick={handleBack} isDisabled={isLoading}>
                Back
              </Button>
              <Button
                colorScheme="green"
                size="sm"
                onClick={handlePay}
                isDisabled={isLoading}
                leftIcon={isLoading ? <Spinner size="xs" /> : undefined}
              >
                {isLoading ? "Processing…" : "Confirm & Pay"}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
