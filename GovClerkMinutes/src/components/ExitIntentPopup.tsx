import { useEffect, useRef, useState } from "react";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  Input,
  Button,
  Text,
  VStack,
} from "@chakra-ui/react";
import { safeCapture } from "@/utils/safePosthog";

const SESSION_KEY = "exitIntentShown";

export function ExitIntentPopup() {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const readyRef = useRef(false);

  useEffect(() => {
    // Only show once per session
    if (typeof window !== "undefined" && sessionStorage.getItem(SESSION_KEY)) {
      return;
    }

    // Only trigger after 5 seconds on the page
    const timer = setTimeout(() => {
      readyRef.current = true;
    }, 5000);

    const handleMouseLeave = (e: MouseEvent) => {
      if (!readyRef.current) return;
      if (e.clientY <= 0) {
        sessionStorage.setItem(SESSION_KEY, "1");
        setIsOpen(true);
        safeCapture("exit_intent_popup_shown");
      }
    };

    document.documentElement.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      clearTimeout(timer);
      document.documentElement.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  const handleSubmit = async () => {
    if (!email) return;
    try {
      await fetch("/api/exit-intent-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      safeCapture("exit_intent_lead_captured", { email });
      setSubmitted(true);
    } catch (err) {
      console.error("Failed to submit exit intent lead", err);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Wait! Get our Free Meeting Minutes Template</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          {submitted ? (
            <Text color="green.600" fontWeight="semibold">
              🎉 Check your inbox! Your templates are on the way.
            </Text>
          ) : (
            <VStack spacing={4} align="stretch">
              <Text color="gray.600">
                Download our professionally formatted meeting minutes template pack — used by 200+
                government organizations.
              </Text>
              <Input
                placeholder="Your email address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              />
              <Button
                bg="#FF6B35"
                color="white"
                _hover={{ bg: "#e85e28" }}
                onClick={handleSubmit}
                size="lg"
              >
                Get Free Templates
              </Button>
            </VStack>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
