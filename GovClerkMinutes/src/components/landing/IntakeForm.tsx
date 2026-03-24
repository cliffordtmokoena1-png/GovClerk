import {
  Box,
  Input,
  InputGroup,
  InputRightElement,
  Button,
  FormControl,
  FormErrorMessage,
  Text,
  useBreakpointValue,
  VStack,
  Flex,
  Fade,
  ScaleFade,
  Heading,
  SimpleGrid,
  SlideFade,
  HStack,
} from "@chakra-ui/react";
import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import { FaArrowRight, FaCheckCircle } from "react-icons/fa";
import { safeCapture } from "@/utils/safePosthog";
import { isPossiblePhoneNumber } from "react-phone-number-input";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";
import {
  IntakeFormStep,
  IntakeFormEmailStepBody,
  IntakeFormFirstNameStepBody,
  IntakeFormPhoneStepBody,
  IntakeFormFrequencyStepBody,
  IntakeFormDueDateStepBody,
} from "@/IntakeForm/IntakeFormStep";
import { assertString } from "@/utils/assert";

const findVisibleQuoteForm = () => {
  const forms = Array.from(
    document.querySelectorAll('[data-quote-request-form="true"]')
  ) as HTMLElement[];

  return (
    forms.find((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }) ??
    forms[0] ??
    null
  );
};

export const scrollToQuoteForm = () => {
  console.info("[scrollToQuoteForm] Function called");

  if (globalThis.window === undefined) {
    console.info("[scrollToQuoteForm] Window is undefined");
    return false;
  }

  const form = findVisibleQuoteForm();
  console.info("[scrollToQuoteForm] Form element:", form);

  if (!form) {
    console.info("[scrollToQuoteForm] Form not found, returning false");
    return false;
  }

  const scrollTarget = (form.closest("section") as HTMLElement | null) ?? form;

  const nav = document.querySelector("nav") as HTMLElement | null;
  const navRect = nav?.getBoundingClientRect();
  const navHeight = navRect?.height ?? 0;
  const verticalBuffer = navHeight > 0 ? 16 : 0;
  const offset = navHeight + verticalBuffer;

  const targetTop = scrollTarget.getBoundingClientRect().top + window.scrollY - offset;
  const clampedTop = Math.max(targetTop, 0);

  console.info("[scrollToQuoteForm] Scrolling to offset position:", {
    scrollTarget,
    offset,
    clampedTop,
  });

  window.scrollTo({
    top: clampedTop,
    behavior: "smooth",
  });

  const focusDelayMs = 400;

  window.setTimeout(() => {
    const firstNameInput = form.querySelector('input[name="firstName"]') as HTMLInputElement | null;
    if (firstNameInput) {
      firstNameInput.focus();
      return;
    }

    const firstInput = form.querySelector("input, textarea, select") as HTMLElement | null;
    firstInput?.focus();
  }, focusDelayMs);

  return true;
};

export const scrollToIntakeForm = () => {
  const intakeForm = document.getElementById("intake-form");

  if (intakeForm) {
    intakeForm.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });

    // Try to focus the email input after scroll completes
    // Small delay allows smooth scroll and potential layout changes to finish
    setTimeout(() => {
      const emailInput = intakeForm.querySelector('input[type="email"]') as HTMLInputElement | null;
      if (emailInput) {
        emailInput.focus();
        return;
      }

      // Fallback: focus the first input inside the intake form
      const firstInput = intakeForm.querySelector("input") as HTMLInputElement | null;
      if (firstInput) {
        firstInput.focus();
      }
    }, 350);
  } else {
    window.location.href = "/#intake-form";
  }
};

interface IntakeFormProps {
  emailInputRef?: React.RefObject<HTMLInputElement | null>;
  country: string;
}

type SubmitState = "unsubmitted" | "signup_success" | "signin_success";

export default function IntakeForm({ emailInputRef, country }: IntakeFormProps) {
  const router = useRouter();
  const [step, setStep] = useState(IntakeFormStep.ASK_EMAIL);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [phone, setPhone] = useState("");
  const [frequency, setFrequency] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [newUserId, setNewUserId] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<"idle" | "signin_success" | "signup_success">(
    "idle"
  );
  const hasInteractedRef = useRef(false);
  const firstNameInputRef = useRef<HTMLInputElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const frequencySelectRef = useRef<HTMLSelectElement>(null);
  const dueDateInputRef = useRef<HTMLInputElement>(null);
  const isMobile = useBreakpointValue({ base: true, md: false });

  useEffect(() => {
    const focusCurrentInput = () => {
      setTimeout(() => {
        switch (step) {
          case IntakeFormStep.ASK_EMAIL:
            if (emailInputRef?.current) {
              emailInputRef.current.focus();
            }
            break;
          case IntakeFormStep.ASK_FIRST_NAME:
            if (firstNameInputRef.current) {
              firstNameInputRef.current.focus();
            }
            break;
          case IntakeFormStep.ASK_PHONE:
            if (phoneInputRef.current) {
              phoneInputRef.current.focus();
            }
            break;
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

  useEffect(() => {
    const shouldLockScroll =
      isMobile &&
      (step > IntakeFormStep.ASK_EMAIL ||
        submitState === "signin_success" ||
        submitState === "signup_success");

    if (shouldLockScroll) {
      const originalOverflow = document.body.style.overflow;
      const originalPosition = document.body.style.position;

      document.body.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.width = "100%";

      return () => {
        document.body.style.overflow = originalOverflow;
        document.body.style.position = originalPosition;
        document.body.style.width = "";
      };
    }
  }, [step, submitState, isMobile]);

  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateStep = (overrides?: { frequency?: string; dueDate?: string }) => {
    const currentFrequency = overrides?.frequency ?? frequency;
    const currentDueDate = overrides?.dueDate ?? dueDate;

    if (step === IntakeFormStep.ASK_EMAIL) {
      if (!isValidEmail(email)) {
        setError("Please enter a valid email address");
        safeCapture("v2_intake_form_validation_error", {
          variant: "v2",
          error_type: "invalid_email",
        });
        if (emailInputRef?.current) {
          emailInputRef.current.focus();
        }
        return false;
      }
    } else if (step === IntakeFormStep.ASK_FIRST_NAME) {
      if (!firstName.trim()) {
        setError("Please enter your first name");
        return false;
      }
    } else if (step === IntakeFormStep.ASK_PHONE) {
      if (!phone) {
        setError("Please enter your phone number");
        return false;
      } else if (!isPossiblePhoneNumber(phone)) {
        setError("Please enter a valid phone number");
        return false;
      }
    } else if (step === IntakeFormStep.ASK_FREQUENCY) {
      if (!currentFrequency) {
        setError("Please select how often you write minutes");
        return false;
      }
    } else if (step === IntakeFormStep.ASK_DUE_DATE) {
      if (!currentDueDate) {
        setError("Please select a due date");
        return false;
      }
    }
    setError("");
    return true;
  };

  const handleNext = async (overrides?: { frequency?: string; dueDate?: string }) => {
    try {
      setIsLoading(true);

      if (!validateStep(overrides)) {
        return;
      }

      safeCapture("v2_intake_form_step_completed", {
        variant: "v2",
        step,
        device: isMobile ? "mobile" : "desktop",
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
            body: JSON.stringify(body),
            headers: {
              "Content-Type": "application/json",
            },
          });

          if (res.ok) {
            const { userId, existingUserId } = await res.json();
            setNewUserId(userId);

            if (existingUserId) {
              setSubmitState("signin_success");
              safeCapture("v2_intake_form_signin_success", {
                variant: "v2",
                device: isMobile ? "mobile" : "desktop",
              });
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
            body: JSON.stringify(body),
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
            body: JSON.stringify(body),
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
            frequency: overrides?.frequency ?? frequency,
          };
          const res = await fetch("/api/intake-form-step", {
            method: "POST",
            body: JSON.stringify(body),
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
            dueDate: overrides?.dueDate ?? dueDate,
          };
          const res = await fetch("/api/intake-form-step", {
            method: "POST",
            body: JSON.stringify(body),
            headers: {
              "Content-Type": "application/json",
            },
          });

          if (res.ok) {
            setSubmitState("signup_success");
            safeCapture("v2_intake_form_completed", {
              variant: "v2",
              device: isMobile ? "mobile" : "desktop",
            });
          } else {
            setError("Something went wrong. Please try again.");
          }
          break;
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const getPlaceholder = () => {
    switch (country) {
      case "GB":
        return "+44 20 7946 0958";
      case "ZA":
        return "+27 21 123 4567";
      default:
        return "+1 (555) 555-5555";
    }
  };

  const getDueDatePreset = (preset: string): string => {
    const today = new Date();
    switch (preset) {
      case "today":
        return today.toISOString().split("T")[0];
      case "tomorrow":
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow.toISOString().split("T")[0];
      case "7days":
        const week = new Date(today);
        week.setDate(week.getDate() + 7);
        return week.toISOString().split("T")[0];
      case "14days":
        const twoWeeks = new Date(today);
        twoWeeks.setDate(twoWeeks.getDate() + 14);
        return twoWeeks.toISOString().split("T")[0];
      case "nextmonth":
        const nextMonth = new Date(today);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        return nextMonth.toISOString().split("T")[0];
      default:
        return "";
    }
  };

  const inputStyles = useMemo(
    () => ({
      bg: "white",
      borderColor: "rgba(59, 130, 246, 0.2)",
      borderWidth: "1px",
      _hover: {
        borderColor: "rgba(59, 130, 246, 0.4)",
      },
      _focus: {
        borderColor: "blue.500",
        boxShadow: "none",
        borderWidth: "1px",
      },
      _placeholder: { color: "gray.400" },
      transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
    }),
    []
  );

  if (submitState === "signin_success" || submitState === "signup_success") {
    const isSignIn = submitState === "signin_success";
    const iconBg = isSignIn ? "green.50" : "rgba(239, 246, 255, 0.8)";
    const iconBorder = isSignIn ? "green.200" : "rgba(59, 130, 246, 0.3)";
    const iconColor = isSignIn ? "#48BB78" : "#3B82F6";
    const title = isSignIn ? "We found your account!" : "Check your email!";
    const message = isSignIn
      ? "Check your email - we sent you a login link."
      : "We sent you a link to get started. Click it to access your dashboard.";

    return (
      <Fade in transition={{ enter: { duration: 0.5 } }}>
        <Box
          w="full"
          maxW={{ base: "100%", md: "500px" }}
          mx="auto"
          position={{ base: "fixed", md: "relative" }}
          top={{ base: 0, md: "auto" }}
          left={{ base: 0, md: "auto" }}
          right={{ base: 0, md: "auto" }}
          bottom={{ base: 0, md: "auto" }}
          zIndex={{ base: 1000, md: "auto" }}
        >
          <VStack
            spacing={6}
            p={{ base: 8, md: 10 }}
            bg="rgba(255, 255, 255, 0.95)"
            backdropFilter="blur(12px)"
            borderRadius={{ base: "none", md: "2xl" }}
            border="1px solid"
            borderColor="rgba(59, 130, 246, 0.2)"
            minH={{ base: "100vh", md: "auto" }}
            justifyContent={{ base: "center", md: "flex-start" }}
            transition="all 0.4s cubic-bezier(0.4, 0, 0.2, 1)"
          >
            <ScaleFade in initialScale={0.9} transition={{ enter: { duration: 0.4 } }}>
              <Flex
                bg={iconBg}
                p={4}
                borderRadius="full"
                border="2px solid"
                borderColor={iconBorder}
                transition="all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
              >
                <FaCheckCircle color={iconColor} size={40} />
              </Flex>
            </ScaleFade>
            <Fade in transition={{ enter: { duration: 0.4, delay: 0.2 } }}>
              <VStack spacing={2}>
                <Text
                  fontSize={{ base: "xl", md: "2xl" }}
                  fontWeight="normal"
                  fontFamily="Georgia, serif"
                  color="gray.800"
                >
                  {title}
                </Text>
                <Text fontSize="md" color="gray.600" textAlign="center">
                  {message}
                </Text>
              </VStack>
            </Fade>
          </VStack>
        </Box>
      </Fade>
    );
  }

  const renderStep = () => {
    switch (step) {
      case IntakeFormStep.ASK_EMAIL:
        return (
          <>
            {isMobile ? (
              <Input
                ref={emailInputRef}
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError("");
                }}
                onFocus={() => {
                  if (!hasInteractedRef.current) {
                    hasInteractedRef.current = true;
                    safeCapture("v2_intake_form_focused", {
                      variant: "v2",
                      device: "mobile",
                    });
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleNext();
                  }
                }}
                placeholder="Enter your email to get started"
                size="lg"
                {...inputStyles}
              />
            ) : (
              <InputGroup size="lg">
                <Input
                  ref={emailInputRef}
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError("");
                  }}
                  onFocus={() => {
                    if (!hasInteractedRef.current) {
                      hasInteractedRef.current = true;
                      safeCapture("v2_intake_form_focused", {
                        variant: "v2",
                        device: "desktop",
                      });
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleNext();
                    }
                  }}
                  placeholder="Enter your email to get started"
                  pr="140px"
                  {...inputStyles}
                />
                <InputRightElement width="auto" pr={1.5}>
                  <Button
                    bg="#FF6B35"
                    color="white"
                    size="md"
                    onClick={() => handleNext()}
                    rightIcon={<FaArrowRight />}
                    isLoading={isLoading}
                    transition="all 0.25s cubic-bezier(0.4, 0, 0.2, 1)"
                    _hover={{
                      "@media (hover: hover)": {
                        bg: "#E65A2E",
                        transform: "translateX(2px)",
                      },
                    }}
                    _active={{
                      transform: "translateX(0)",
                    }}
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
          <VStack spacing={6} w="full" align="stretch">
            <VStack spacing={2} align="stretch">
              <Heading
                as="h2"
                fontSize="2xl"
                fontWeight="normal"
                fontFamily="Georgia, serif"
                color="gray.800"
                textAlign="left"
              >
                Before we begin, what should we call you?
              </Heading>
              <Text fontSize="sm" color="gray.600" textAlign="left">
                We&apos;d love to make this personal
              </Text>
            </VStack>
            <Input
              ref={firstNameInputRef}
              type="text"
              value={firstName}
              onChange={(e) => {
                setFirstName(e.target.value);
                setError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleNext();
                }
              }}
              placeholder="Your first name"
              size="lg"
              fontSize="md"
              w="full"
              {...inputStyles}
            />
          </VStack>
        );
      case IntakeFormStep.ASK_PHONE:
        return (
          <VStack spacing={6} w="full" align="stretch">
            <VStack spacing={2} align="stretch">
              <Heading
                as="h2"
                fontSize="2xl"
                fontWeight="normal"
                fontFamily="Georgia, serif"
                color="gray.800"
                textAlign="left"
              >
                Hi{firstName ? `, ${firstName}` : ""}! What&apos;s your phone number?
              </Heading>
              <Text fontSize="sm" color="gray.600" textAlign="left">
                We&apos;ll send you updates about your minutes
              </Text>
            </VStack>
            <PhoneInput
              international
              autoFocus
              placeholder={getPlaceholder()}
              value={phone}
              onChange={(value) => setPhone(value || "")}
              defaultCountry={country as any}
              inputComponent={(props: any) => (
                <Input
                  {...props}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleNext();
                    }
                  }}
                  size="lg"
                  fontSize="md"
                  w="full"
                  {...inputStyles}
                />
              )}
            />
          </VStack>
        );
      case IntakeFormStep.ASK_FREQUENCY:
        return (
          <VStack spacing={6} w="full" align="stretch">
            <VStack spacing={2} align="stretch">
              <Heading
                as="h2"
                fontSize="2xl"
                fontWeight="normal"
                fontFamily="Georgia, serif"
                color="gray.800"
                textAlign="left"
              >
                How often do you write minutes?
              </Heading>
            </VStack>
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3} w="full">
              {[
                { value: "weekly", label: "Weekly" },
                { value: "monthly", label: "Monthly" },
                { value: "quarterly", label: "Quarterly" },
                { value: "yearly", label: "Yearly" },
                { value: "tons", label: "Many times per week" },
                { value: "sporadic", label: "No fixed schedule" },
              ].map((option) => (
                <Button
                  key={option.value}
                  onClick={() => {
                    if (isAdvancing) {
                      return;
                    }
                    setFrequency(option.value);
                    setError("");
                    setIsAdvancing(true);
                    setTimeout(() => {
                      handleNext({ frequency: option.value });
                      setIsAdvancing(false);
                    }, 200);
                  }}
                  isDisabled={isAdvancing && frequency !== option.value}
                  variant="outline"
                  h="auto"
                  py={4}
                  px={5}
                  bg={frequency === option.value ? "blue.500" : "white"}
                  color={frequency === option.value ? "white" : "gray.700"}
                  border="1px solid"
                  borderColor={frequency === option.value ? "blue.500" : "rgba(59, 130, 246, 0.2)"}
                  borderRadius="lg"
                  textAlign="left"
                  fontWeight="normal"
                  transition="all 0.25s cubic-bezier(0.4, 0, 0.2, 1)"
                  _hover={{
                    borderColor: "blue.500",
                    bg: frequency === option.value ? "blue.600" : "rgba(239, 246, 255, 0.5)",
                  }}
                  opacity={isAdvancing && frequency !== option.value ? 0.5 : 1}
                >
                  {option.label}
                </Button>
              ))}
            </SimpleGrid>
          </VStack>
        );
      case IntakeFormStep.ASK_DUE_DATE:
        if (showCustomDate) {
          return (
            <VStack spacing={6} w="full" align="stretch">
              <VStack spacing={2} align="stretch">
                <Heading
                  as="h2"
                  fontSize="2xl"
                  fontWeight="normal"
                  fontFamily="Georgia, serif"
                  color="gray.800"
                  textAlign="left"
                >
                  Pick your custom date
                </Heading>
              </VStack>
              <Input
                ref={dueDateInputRef}
                type="date"
                value={dueDate}
                onChange={(e) => {
                  setDueDate(e.target.value);
                  setError("");
                }}
                size="lg"
                fontSize="md"
                w="full"
                {...inputStyles}
              />
            </VStack>
          );
        }
        return (
          <VStack spacing={6} w="full" align="stretch">
            <VStack spacing={2} align="stretch">
              <Heading
                as="h2"
                fontSize="2xl"
                fontWeight="normal"
                fontFamily="Georgia, serif"
                color="gray.800"
                textAlign="left"
              >
                When are your next minutes due?
              </Heading>
            </VStack>
            <SimpleGrid columns={2} spacing={3} w="full">
              {[
                { value: "today", label: "Today" },
                { value: "tomorrow", label: "Tomorrow" },
                { value: "7days", label: "In 7 days" },
                { value: "14days", label: "In 14 days" },
                { value: "nextmonth", label: "Next month" },
                { value: "custom", label: "Custom date" },
              ].map((option) => (
                <Button
                  key={option.value}
                  onClick={() => {
                    if (isAdvancing) {
                      return;
                    }
                    if (option.value === "custom") {
                      setShowCustomDate(true);
                      setError("");
                    } else {
                      const presetDate = getDueDatePreset(option.value);
                      setDueDate(presetDate);
                      setError("");
                      setIsAdvancing(true);
                      setTimeout(() => {
                        handleNext({ dueDate: presetDate });
                        setIsAdvancing(false);
                      }, 200);
                    }
                  }}
                  isDisabled={isAdvancing && dueDate !== getDueDatePreset(option.value)}
                  variant="outline"
                  h="auto"
                  py={4}
                  px={5}
                  bg={dueDate === getDueDatePreset(option.value) ? "blue.500" : "white"}
                  color={dueDate === getDueDatePreset(option.value) ? "white" : "gray.700"}
                  border="1px solid"
                  borderColor={
                    dueDate === getDueDatePreset(option.value)
                      ? "blue.500"
                      : "rgba(59, 130, 246, 0.2)"
                  }
                  borderRadius="lg"
                  textAlign="left"
                  fontWeight="normal"
                  transition="all 0.25s cubic-bezier(0.4, 0, 0.2, 1)"
                  _hover={{
                    borderColor: "blue.500",
                    bg:
                      dueDate === getDueDatePreset(option.value)
                        ? "blue.600"
                        : "rgba(239, 246, 255, 0.5)",
                  }}
                  opacity={isAdvancing && dueDate !== getDueDatePreset(option.value) ? 0.5 : 1}
                >
                  {option.label}
                </Button>
              ))}
            </SimpleGrid>
          </VStack>
        );
      default:
        return null;
    }
  };

  // Show initial email step inline
  if (step === IntakeFormStep.ASK_EMAIL) {
    return (
      <FormControl id="intake-form" isInvalid={!!error}>
        <Box w="full" maxW={{ base: "600px", md: "450px" }} mx="auto">
          <VStack spacing={3}>
            {renderStep()}

            {isMobile && (
              <Button
                w="full"
                size="lg"
                bg="#FF6B35"
                color="white"
                onClick={() => handleNext()}
                isLoading={isLoading}
                transition="all 0.25s cubic-bezier(0.4, 0, 0.2, 1)"
                _hover={{
                  "@media (hover: hover)": {
                    bg: "#E65A2E",
                    transform: "translateY(-1px)",
                  },
                }}
                _active={{
                  transform: "translateY(0)",
                }}
              >
                Start for Free
              </Button>
            )}

            {error && <FormErrorMessage justifyContent="center">{error}</FormErrorMessage>}

            <Text fontSize="sm" color="gray.600" textAlign="center" fontWeight="medium">
              Start with 40 minutes of free transcription
            </Text>
          </VStack>
        </Box>
      </FormControl>
    );
  }

  // Show card-based wizard for remaining steps
  return (
    <FormControl id="intake-form" isInvalid={!!error}>
      <Fade in={step > IntakeFormStep.ASK_EMAIL} unmountOnExit>
        <Box
          w="full"
          maxW={{ base: "100%", md: "550px" }}
          mx="auto"
          position={{ base: "fixed", md: "relative" }}
          top={{ base: 0, md: "auto" }}
          left={{ base: 0, md: "auto" }}
          right={{ base: 0, md: "auto" }}
          bottom={{ base: 0, md: "auto" }}
          zIndex={{ base: 1000, md: "auto" }}
        >
          <VStack
            spacing={8}
            p={{ base: 10, md: 12 }}
            bg="rgba(255, 255, 255, 0.95)"
            backdropFilter="blur(12px)"
            borderRadius={{ base: "none", md: "2xl" }}
            border="1px solid"
            borderColor="rgba(59, 130, 246, 0.2)"
            minH={{ base: "100vh", md: "auto" }}
            justifyContent={{ base: "center", md: "flex-start" }}
            transition="all 0.4s cubic-bezier(0.4, 0, 0.2, 1)"
          >
            <HStack spacing={2} justify="center">
              {[...Array(4)].map((_, i) => {
                const dotStep = i + 2;
                const currentStep = step;
                return (
                  <Box
                    key={i}
                    w={dotStep === currentStep ? 3 : 2}
                    h={dotStep === currentStep ? 3 : 2}
                    bg={dotStep <= currentStep ? "blue.500" : "gray.300"}
                    borderRadius="full"
                    transition="all 0.4s cubic-bezier(0.4, 0, 0.2, 1)"
                  />
                );
              })}
            </HStack>

            <SlideFade
              key={`${step}-${showCustomDate}`}
              in
              offsetX={20}
              offsetY={0}
              transition={{ enter: { duration: 0.3 } }}
            >
              <VStack spacing={8} w="full" align="stretch">
                {renderStep()}

                {(step === IntakeFormStep.ASK_FIRST_NAME ||
                  step === IntakeFormStep.ASK_PHONE ||
                  (step === IntakeFormStep.ASK_DUE_DATE && showCustomDate)) && (
                  <Button
                    w="full"
                    size="lg"
                    h="14"
                    bg="#FF6B35"
                    color="white"
                    onClick={() => handleNext()}
                    isLoading={isLoading}
                    fontSize="md"
                    fontWeight="medium"
                    transition="all 0.25s cubic-bezier(0.4, 0, 0.2, 1)"
                    _hover={{
                      "@media (hover: hover)": {
                        bg: "#E65A2E",
                        transform: "translateY(-1px)",
                      },
                    }}
                    _active={{
                      transform: "translateY(0)",
                    }}
                  >
                    Continue
                  </Button>
                )}

                {error && <FormErrorMessage justifyContent="center">{error}</FormErrorMessage>}
              </VStack>
            </SlideFade>
          </VStack>
        </Box>
      </Fade>
    </FormControl>
  );
}
