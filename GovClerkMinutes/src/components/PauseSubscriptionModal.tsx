import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  FormControl,
  FormLabel,
  Textarea,
  useToast,
  RadioGroup,
  Radio,
  Stack,
  Box,
} from "@chakra-ui/react";
import { useState, useCallback, useRef } from "react";
import { PauseReason } from "@/pages/api/get-customer-details";
import { safeCapture } from "@/utils/safePosthog";
import posthog from "posthog-js";

type PauseSubscriptionModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

type ReasonKind = PauseReason["kind"];

const CANCEL_REASONS: { label: string; value: ReasonKind }[] = [
  { label: "I don't need minutes every month", value: "BadCadence" },
  { label: "Too expensive", value: "TooExpensive" },
  { label: "I found a better service", value: "BetterAlternative" },
  { label: "I don't write minutes anymore", value: "NotNeeded" },
  { label: "Bad quality minutes", value: "BadQuality" },
  { label: "Something else", value: "Other" },
];

const PauseSubscriptionModal = ({ isOpen, onClose, onSuccess }: PauseSubscriptionModalProps) => {
  const [selectedReason, setSelectedReason] = useState<ReasonKind | "">("");
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const pauseClickedRef = useRef(false);
  const toast = useToast();

  const handleModalClose = useCallback(() => {
    if (!pauseClickedRef.current) {
      safeCapture("billing_subscription_kept", {
        type: "modal_closed",
      });
    }
    pauseClickedRef.current = false;
    onClose();
  }, [onClose]);

  const handleKeepSubscription = useCallback(() => {
    safeCapture("billing_subscription_kept", {
      type: "keep_subscription",
    });
    onClose();
  }, [onClose]);

  const handleSubmit = async () => {
    if (!selectedReason) {
      toast({
        title: "Please provide a reason",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    pauseClickedRef.current = true;

    const reason: PauseReason =
      selectedReason === "Other"
        ? { kind: "Other", feedback: feedback.trim() }
        : { kind: selectedReason };

    safeCapture("billing_subscription_paused", {
      reason,
    });

    setIsSubmitting(true);
    try {
      const posthog_session_id = posthog.get_session_id();

      const response = await fetch("/api/pause-subscription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-POSTHOG-SESSION-ID": posthog_session_id,
        },
        body: JSON.stringify({ reason }),
      });

      if (!response.ok) {
        throw new Error("Failed to pause subscription");
      }

      toast({
        title: "Subscription canceled",
        description: "Your subscription will be canceled at the end of the billing period.",
        status: "success",
        duration: 5000,
        isClosable: true,
      });
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error pausing subscription:", error);
      toast({
        title: "Error",
        description: "Failed to pause subscription. Please try again.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReasonChange = (value: string) => {
    const reason = value as ReasonKind;
    setSelectedReason(reason);
    safeCapture("billing_subscription_reason", {
      reason,
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={handleModalClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Pause subscription</ModalHeader>
        <ModalBody>
          <FormControl>
            <FormLabel>Why would you like to cancel your subscription?</FormLabel>
            <RadioGroup value={selectedReason} onChange={handleReasonChange}>
              <Stack spacing={3}>
                {CANCEL_REASONS.map(({ label, value }) => (
                  <Radio key={value} value={value}>
                    {label}
                  </Radio>
                ))}
              </Stack>
            </RadioGroup>
            {selectedReason === "Other" && (
              <Box mt={4}>
                <Textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Please tell us more..."
                  rows={4}
                />
              </Box>
            )}
          </FormControl>
        </ModalBody>
        <ModalFooter gap={2}>
          <Button variant="ghost" onClick={handleKeepSubscription}>
            Keep Subscription
          </Button>
          <Button
            colorScheme="red"
            onClick={handleSubmit}
            isLoading={isSubmitting}
            loadingText="Canceling..."
          >
            Pause Subscription
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default PauseSubscriptionModal;
