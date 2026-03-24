import {
  Box,
  Button,
  Flex,
  FormControl,
  FormErrorMessage,
  Input,
  InputGroup,
  InputRightElement,
  Stack,
  Text,
  useBreakpointValue,
  Select,
} from "@chakra-ui/react";
import { useRouter } from "next/router";
import { safeCapture } from "@/utils/safePosthog";
import { useState, useRef, useEffect } from "react";
import { FaCheckCircle } from "react-icons/fa";
import { FaArrowRight } from "react-icons/fa";
import posthog from "posthog-js";
import { assertString } from "@/utils/assert";
import { usePosthogProvider } from "@/components/CustomPosthogProvider";
import {
  IntakeFormDueDateStepBody,
  IntakeFormEmailStepBody,
  IntakeFormFirstNameStepBody,
  IntakeFormFrequencyStepBody,
  IntakeFormPhoneStepBody,
  IntakeFormStep,
} from "./IntakeFormStep";
import IntakeFormPhoneStep from "./IntakeFormPhoneStep";
import { isPossiblePhoneNumber } from "react-phone-number-input";
import WhatsappCta from "@/components/WhatsappCta";
import { WHATSAPP_BUSINESS_PHONE_TO_ID } from "@/admin/whatsapp/api/consts";

type SubmitState = "unsubmitted" | "signup_submit" | "signin_submit";

type Props = {
  fromFbAd?: boolean;
  emailInputRef?: React.RefObject<HTMLInputElement | null>;
  country: string;
};

export default function MultiStepIntakeForm({ fromFbAd, emailInputRef, country }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [frequency, setFrequency] = useState("");
  const [phone, setPhone] = useState<string>();
  const [error, setError] = useState("");
  const isMobile = useBreakpointValue({ base: true, md: false });
  const { setFreshUserId, setFreshEmail } = usePosthogProvider();
  const [newUserId, setNewUserId] = useState<string>();
  const [isLoadingNextStep, setIsLoadingNextStep] = useState(false);
  const [submitState, setSubmitState] = useState<SubmitState>("unsubmitted");

  // Create refs for each input field
  const firstNameInputRef = useRef<HTMLInputElement>(null);
  const frequencySelectRef = useRef<HTMLSelectElement>(null);
  const dueDateInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the current step's input when step changes
  useEffect(() => {
    const focusCurrentInput = () => {
      // Small delay to ensure the DOM has updated
      setTimeout(() => {
        switch (step) {
          case IntakeFormStep.ASK_EMAIL:
            // Email input is already handled by the existing emailInputRef prop
            if (emailInputRef?.current) {
              emailInputRef.current.focus();
            }
            break;
          case IntakeFormStep.ASK_FIRST_NAME:
            if (firstNameInputRef.current) {
              firstNameInputRef.current.focus();
            }
            break;
          // case IntakeFormStep.ASK_PHONE:
          //   if (phoneInputRef.current) {
          //     phoneInputRef.current.focus();
          //   }
          //   break;
          case IntakeFormStep.ASK_FREQUENCY:
            if (frequencySelectRef.current) {
              frequencySelectRef.current.focus();
            }
            break;
          case IntakeFormStep.ASK_DUE_DATE:
            if (dueDateInputRef.current) {
              dueDateInputRef.current.focus();
            }
            break;
        }
      }, 100);
    };

    focusCurrentInput();
  }, [step, emailInputRef]);

  // Focus email input when form is scrolled into view
  useEffect(() => {
    const formElement = document.getElementById("intake-form");
    if (!formElement) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && step === IntakeFormStep.ASK_EMAIL && emailInputRef?.current) {
            // Delay to ensure smooth scroll completes
            setTimeout(() => {
              emailInputRef.current?.focus();
            }, 300);
          }
        });
      },
      { threshold: 0.5 }
    );

    observer.observe(formElement);

    return () => {
      observer.disconnect();
    };
  }, [step, emailInputRef]);

  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateStep = () => {
    if (step === IntakeFormStep.ASK_EMAIL) {
      if (!isValidEmail(email)) {
        setError("Email is invalid. Please enter a valid email address.");
        safeCapture("email_validation_error", { fromFbAd });
        if (emailInputRef?.current) {
          emailInputRef.current.focus();
        }
        return false;
      }
    } else if (step === IntakeFormStep.ASK_FIRST_NAME) {
      if (!firstName.trim()) {
        setError("Please enter your first name.");
        return false;
      }
    } else if (step === IntakeFormStep.ASK_PHONE) {
      if (!phone) {
        setError("Please enter your phone number.");
        return false;
      } else if (!isPossiblePhoneNumber(phone)) {
        setError("Please enter a valid phone number.");
        return false;
      }
    } else if (step === IntakeFormStep.ASK_FREQUENCY) {
      if (!frequency) {
        setError("Please select how often you write minutes.");
        return false;
      }
    } else if (step === IntakeFormStep.ASK_DUE_DATE) {
      if (!dueDate) {
        setError("Please select a due date.");
        return false;
      }
    }
    setError("");
    return true;
  };

  const handleNext = async () => {
    try {
      setIsLoadingNextStep(true);

      if (!validateStep()) {
        return;
      }

      posthog.capture("intake_form_step_completed", {
        step,
        email,
        first_name: firstName,
        due_date: dueDate,
        frequency,
      });

      switch (step) {
        case IntakeFormStep.ASK_EMAIL: {
          const body: IntakeFormEmailStepBody = {
            step: IntakeFormStep.ASK_EMAIL,
            email,
            utmParams: {
              utm_source: router.query.utm_source as any,
              utm_medium: router.query.utm_medium as any,
              utm_campaign: router.query.utm_campaign as any,
              utm_content: router.query.utm_content as any,
              utm_term: router.query.utm_term as any,
            },
          };

          const res = await fetch("/api/intake-form-step", {
            method: "POST",
            body: JSON.stringify({
              ...body,
            }),
            headers: {
              "Content-Type": "application/json",
            },
          });

          if (res.ok) {
            const { userId, existingUserId } = await res.json();
            setFreshUserId(userId);
            setFreshEmail(email);
            setNewUserId(userId);
            if (existingUserId) {
              setSubmitState("signin_submit");
              return;
            }

            setStep(step + 1);
          } else {
            setError("Invalid email. Please try again.");
          }

          break;
        }
        case IntakeFormStep.ASK_FIRST_NAME: {
          const body: IntakeFormFirstNameStepBody = {
            step: IntakeFormStep.ASK_FIRST_NAME,
            userId: assertString(newUserId),
            firstName,
          };
          const res = await fetch("/api/intake-form-step", {
            method: "POST",
            body: JSON.stringify({
              ...body,
            }),
            headers: {
              "Content-Type": "application/json",
            },
          });

          if (res.ok) {
            setStep(step + 1);
          } else {
            setError("Something went wrong. Please try again.");
          }

          break;
        }
        case IntakeFormStep.ASK_PHONE: {
          const body: IntakeFormPhoneStepBody = {
            step: IntakeFormStep.ASK_PHONE,
            userId: assertString(newUserId),
            phone: assertString(phone),
          };
          const res = await fetch("/api/intake-form-step", {
            method: "POST",
            body: JSON.stringify({
              ...body,
            }),
            headers: {
              "Content-Type": "application/json",
            },
          });

          if (res.ok) {
            setStep(step + 1);
          } else {
            setError("Something went wrong. Please try again.");
          }

          break;
        }
        case IntakeFormStep.ASK_FREQUENCY: {
          const body: IntakeFormFrequencyStepBody = {
            step: IntakeFormStep.ASK_FREQUENCY,
            userId: assertString(newUserId),
            frequency,
          };
          const res = await fetch("/api/intake-form-step", {
            method: "POST",
            body: JSON.stringify({
              ...body,
            }),
            headers: {
              "Content-Type": "application/json",
            },
          });

          if (res.ok) {
            setStep(step + 1);
          } else {
            setError("Something went wrong. Please try again.");
          }

          break;
        }
        case IntakeFormStep.ASK_DUE_DATE: {
          const body: IntakeFormDueDateStepBody = {
            step: IntakeFormStep.ASK_DUE_DATE,
            userId: assertString(newUserId),
            dueDate,
          };
          const res = await fetch("/api/intake-form-step", {
            method: "POST",
            body: JSON.stringify({
              ...body,
            }),
            headers: {
              "Content-Type": "application/json",
            },
          });

          if (res.ok) {
            setStep(step + 1);
          } else {
            setError("Something went wrong. Please try again.");
          }

          break;
        }
      }
    } finally {
      setIsLoadingNextStep(false);

      if (step === Object.keys(IntakeFormStep).filter((k) => isNaN(Number(k))).length - 1) {
        safeCapture("form_submitted", {
          from_fb_ad: fromFbAd,
          email,
          first_name: firstName,
          due_date: dueDate,
          frequency,
        });

        setSubmitState("signup_submit");
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleNext();
    }
  };

  if (submitState === "signup_submit") {
    const getUnqualifiedMessage = () => {
      return firstName
        ? `Hi, it's ${firstName} - I'm interested in GovClerkMinutes. My email is ${email}`
        : `Hi, I'm interested in GovClerkMinutes. My email is ${email}`;
    };
    const getQualifiedMessage = () => {
      return firstName
        ? `Hi, it's ${firstName} - which plan is best for me?`
        : "Hi, which plan is best for me?";
    };
    const shouldQualify = posthog.isFeatureEnabled("intake-says-is-paid");
    const whatsappMessage = shouldQualify ? getQualifiedMessage() : getUnqualifiedMessage();

    return (
      <Flex
        direction="column"
        gap={4}
        alignItems="center"
        justifyContent="center"
        textAlign="center"
        p={4}
      >
        <Text fontSize="md" fontWeight="semibold">
          {shouldQualify
            ? "Chat with us to learn the best plan for you!"
            : "We can help you get started on WhatsApp!"}
        </Text>
        <WhatsappCta phone="27848590684" message={whatsappMessage} />
        <Text fontSize="sm">(We also emailed you!)</Text>
      </Flex>
    );
  } else if (submitState === "signin_submit") {
    const whatsappMessage = `Hi, I have a question about my account (${email}).  My question is:`;
    return (
      <Flex
        direction="column"
        gap={4}
        alignItems="center"
        justifyContent="center"
        textAlign="center"
        p={4}
      >
        <Flex bg="green.50" p={4} borderRadius="full" border="2px solid" borderColor="green.200">
          <FaCheckCircle color="#48BB78" size={40} />
        </Flex>
        <Stack spacing={1}>
          <Text fontSize="md" fontWeight="semibold">
            We found your account!
          </Text>
          <Text fontSize="md" color="gray.600">
            Check your email - we sent you a login link.
          </Text>
          <Flex mt={8}></Flex>
          <WhatsappCta phone="27848590684" message={whatsappMessage} />
        </Stack>
      </Flex>
    );
  }

  const renderStep = () => {
    switch (step) {
      case IntakeFormStep.ASK_EMAIL:
        return (
          <>
            <Text fontSize="lg" textAlign="center" fontWeight="semibold">
              Enter your email to get started
            </Text>
            {isMobile ? (
              <>
                <Input
                  id="email-input"
                  type="email"
                  ref={emailInputRef}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError("");
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your email..."
                  size="lg"
                  bg="white"
                  _placeholder={{ color: "gray.500" }}
                />
              </>
            ) : (
              <InputGroup size="lg">
                <Input
                  id="email-input"
                  type="email"
                  ref={emailInputRef}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError("");
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your email..."
                  bg="white"
                  _placeholder={{ color: "gray.500" }}
                />
                <InputRightElement width="auto" pr={2}>
                  <Button
                    type="button"
                    colorScheme="blue"
                    size="md"
                    onClick={handleNext}
                    rightIcon={<FaArrowRight />}
                    isLoading={isLoadingNextStep}
                  >
                    Next
                  </Button>
                </InputRightElement>
              </InputGroup>
            )}
          </>
        );
      case IntakeFormStep.ASK_FIRST_NAME:
        return (
          <>
            <Text fontSize="lg" textAlign="center" fontWeight="semibold">
              Enter your first name
            </Text>
            <Input
              id="first-name-input"
              type="text"
              ref={firstNameInputRef}
              value={firstName}
              onChange={(e) => {
                setFirstName(e.target.value);
                setError("");
              }}
              onKeyDown={handleKeyDown}
              placeholder="Your first name"
              size="lg"
              bg="white"
              _placeholder={{ color: "gray.500" }}
            />
          </>
        );
      case IntakeFormStep.ASK_PHONE:
        return (
          <IntakeFormPhoneStep
            country={country}
            phone={phone}
            setPhone={setPhone}
            onKeyDown={handleKeyDown}
          />
        );
      case IntakeFormStep.ASK_FREQUENCY:
        return (
          <>
            <Text fontSize="lg" textAlign="center" fontWeight="semibold">
              How often do you write minutes?
            </Text>
            <Select
              id="frequency-select"
              ref={frequencySelectRef}
              placeholder="Weekly, monthly, etc."
              value={frequency}
              onChange={(e) => {
                setFrequency(e.target.value);
                setError("");
              }}
              onKeyDown={handleKeyDown}
              size="lg"
              bg="white"
            >
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
              <option value="bimonthly">2 times per month (every 2 weeks)</option>
              <option value="biyearly">2 times per year (every 6 months)</option>
              <option value="tons">Many times per week</option>
              <option value="sporadic">No fixed schedule</option>
              <option value="none">None of the above</option>
            </Select>
          </>
        );
      case IntakeFormStep.ASK_DUE_DATE:
        return (
          <>
            <Text fontSize="lg" textAlign="center" fontWeight="semibold">
              When are your next minutes due?
            </Text>
            <Input
              id="due-date-input"
              ref={dueDateInputRef}
              placeholder="MM/DD/YYYY"
              type="date"
              value={dueDate}
              onChange={(e) => {
                setDueDate(e.target.value);
                setError("");
              }}
              onClick={(e) => {
                const target = e.target as HTMLInputElement;
                if (target.showPicker) {
                  target.showPicker();
                }
              }}
              onKeyDown={handleKeyDown}
              size="lg"
              bg="white"
            />
          </>
        );
      default:
        return null;
    }
  };

  return (
    <Box id="intake-form">
      <FormControl isInvalid={!!error}>
        <Stack spacing={2} p={isMobile ? 2 : 0}>
          {renderStep()}
          {((step === 0 && isMobile) || step > 0) && (
            <Button
              type="button"
              colorScheme="orange"
              size="lg"
              onClick={handleNext}
              isLoading={isLoadingNextStep}
            >
              {step < 3 ? "Next" : "Get Started"}
            </Button>
          )}
          {error && (
            <FormErrorMessage
              display="flex"
              justifyContent="center"
              width="100%"
              textAlign="center"
              margin="0 auto"
            >
              {error}
            </FormErrorMessage>
          )}
          <Text fontSize={{ base: "sm", md: "md" }} color="gray.600" textAlign="center">
            Get started with 40 minutes of transcription
          </Text>
        </Stack>
      </FormControl>
    </Box>
  );
}
