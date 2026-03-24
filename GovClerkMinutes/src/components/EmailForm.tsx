import {
  Button,
  Flex,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
  Text,
} from "@chakra-ui/react";
import { useRouter } from "next/router";
import { safeCapture } from "@/utils/safePosthog";
import { useRef, useState } from "react";
import { FaCheckCircle } from "react-icons/fa";
import { usePosthogProvider } from "./CustomPosthogProvider";

type Props = {
  hideTopText?: boolean;
  hideBottomText?: boolean;
  submitted: boolean;
  onSubmit: () => void;
};

export default function EmailForm({ hideTopText, hideBottomText, submitted, onSubmit }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);
  const { setFreshUserId, setFreshEmail } = usePosthogProvider();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    setError(false);
  };

  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const isValid = isValidEmail(input);

  if (submitted) {
    return (
      <Flex
        direction="column"
        gap={2}
        alignItems="center"
        justifyContent="center"
        textAlign="center"
      >
        <Text fontSize="lg">Instructions sent!</Text>
        <Flex>
          <FaCheckCircle color="#48BB78" size={80} />
        </Flex>
        <Text fontSize="lg">
          <Text as="span" fontWeight="semibold" pr={1}>
            Check your email
          </Text>
          for instructions on how to get started
        </Text>
      </Flex>
    );
  }

  return (
    <FormControl isInvalid={error}>
      {!hideTopText && (
        <FormLabel fontWeight="normal">
          <Text fontSize="lg" textAlign="left">
            <Text as="span" fontWeight="semibold" pr={1}>
              Enter your email
            </Text>
            and we&apos;ll send you instructions.
          </Text>
        </FormLabel>
      )}
      <Flex>
        <Input
          // id for excluding $rageclick events in posthog happening on email autofill
          id="landing-page-email-form"
          type="email"
          ref={inputRef}
          value={input}
          onChange={handleInputChange}
          placeholder="Type your email..."
          size="lg"
        />
      </Flex>
      {error && (
        <FormErrorMessage>Email is invalid. Please enter a valid email address.</FormErrorMessage>
      )}
      <Button
        type="submit"
        colorScheme="orange"
        size="lg"
        w="full"
        mt={2}
        onClick={() => {
          if (submitted) {
            return;
          }

          if (!isValid) {
            setError(true);
            if (inputRef.current) {
              inputRef.current.focus();
            }
            return;
          }

          fetch("/api/send-sign-up-email", {
            method: "POST",
            body: JSON.stringify({
              email: input,
              adId: router.query.utm_content,
              utmParams: {
                utm_source: router.query.utm_source,
                utm_medium: router.query.utm_medium,
                utm_campaign: router.query.utm_campaign,
                utm_content: router.query.utm_content,
                utm_term: router.query.utm_term,
              },
            }),
            headers: {
              "Content-Type": "application/json",
            },
          }).then(async (res) => {
            if (res.ok) {
              const { userId } = await res.json();
              setFreshUserId(userId);
              setFreshEmail(input);
            }
          });

          safeCapture("email_form_submitted", { email: input });
          onSubmit();
        }}
      >
        Send me instructions
      </Button>
      {!hideBottomText && (
        <Flex justifyContent="center" pt={1}>
          <Text fontSize="8pt">If you already have an account, we&apos;ll log you in</Text>
        </Flex>
      )}
    </FormControl>
  );
}
