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
} from "@chakra-ui/react";
import { PORTAL_OVERAGE_RATES } from "@/utils/portalPaystack";

type StreamTopUpModalProps = {
  isOpen: boolean;
  onClose: () => void;
  planTier: string | null;
  orgId: string;
};

const HOUR_OPTIONS = [1, 2, 5, 10] as const;
type HourOption = (typeof HOUR_OPTIONS)[number];

type Step = "choose" | "confirm";

export default function StreamTopUpModal({
  isOpen,
  onClose,
  planTier,
  orgId,
}: StreamTopUpModalProps) {
  const [selected, setSelected] = useState<HourOption | null>(null);
  const [step, setStep] = useState<Step>("choose");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pricePerHour = PORTAL_OVERAGE_RATES.stream_hour_zar;

  const handleClose = () => {
    setSelected(null);
    setStep("choose");
    setError(null);
    onClose();
  };

  const handleConfirmChoice = () => {
    if (!selected) {return;}
    setStep("confirm");
  };

  const handleBack = () => {
    setStep("choose");
    setError(null);
  };

  const handlePay = async () => {
    if (!selected) {return;}
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/org/stream-topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hours: selected, orgId }),
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

  const totalCost = selected ? selected * pricePerHour : 0;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} isCentered size="md">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader borderBottomWidth="1px" borderColor="gray.100" pb={3}>
          <Flex alignItems="center" gap={2}>
            <span>📡</span>
            <Text>Top Up Streaming Hours</Text>
          </Flex>
          {planTier && (
            <Text fontSize="xs" color="gray.500" fontWeight="normal" mt={0.5}>
              Current plan: <strong style={{ textTransform: "capitalize" }}>{planTier}</strong>
            </Text>
          )}
        </ModalHeader>
        <ModalCloseButton />

        {step === "choose" ? (
          <>
            <ModalBody py={5}>
              <Text fontSize="sm" color="gray.600" mb={4}>
                Choose how many additional streaming hours you need. These will be added to your
                account immediately after payment.
              </Text>
              <VStack spacing={3} align="stretch">
                {HOUR_OPTIONS.map((hours) => {
                  const cost = hours * pricePerHour;
                  const isSelected = selected === hours;
                  return (
                    <Box
                      key={hours}
                      border="2px solid"
                      borderColor={isSelected ? "blue.500" : "gray.200"}
                      bg={isSelected ? "blue.50" : "white"}
                      borderRadius="lg"
                      p={4}
                      cursor="pointer"
                      onClick={() => setSelected(hours)}
                      transition="all 0.15s"
                      _hover={{ borderColor: "blue.400" }}
                    >
                      <Flex justifyContent="space-between" alignItems="center">
                        <Box>
                          <Text fontWeight="semibold" fontSize="sm" color="gray.800">
                            {hours} extra hour{hours > 1 ? "s" : ""}
                          </Text>
                          <Text fontSize="xs" color="gray.500" mt={0.5}>
                            R{pricePerHour}/hr
                          </Text>
                        </Box>
                        <Text fontWeight="bold" fontSize="sm" color="blue.700">
                          R{cost.toLocaleString()}
                        </Text>
                      </Flex>
                    </Box>
                  );
                })}
              </VStack>
              {selected && (
                <Box mt={4} p={3} bg="green.50" border="1px solid" borderColor="green.200" borderRadius="md">
                  <Text fontSize="sm" color="green.800">
                    Total: <strong>R{totalCost.toLocaleString()}</strong> for{" "}
                    <strong>{selected} hour{selected > 1 ? "s" : ""}</strong>
                  </Text>
                </Box>
              )}
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
                Confirm &amp; Pay
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
                      R{totalCost.toLocaleString()}
                    </Text>{" "}
                    for{" "}
                    <Text as="span" fontWeight="bold" color="blue.700">
                      {selected} extra streaming hour{selected && selected > 1 ? "s" : ""}
                    </Text>
                    . These will be added to your account immediately.
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
