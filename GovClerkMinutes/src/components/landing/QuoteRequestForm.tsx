import {
  Box,
  Button,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Grid,
  Heading,
  Input,
  Textarea,
  VStack,
  Text,
  Link,
  useToast,
  Flex,
  Fade,
  ScaleFade,
} from "@chakra-ui/react";
import { useState, FormEvent, useEffect, useRef } from "react";
import PhoneInput, { isPossiblePhoneNumber, Country } from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { FaCheckCircle, FaCalendarAlt } from "react-icons/fa";
import { useRouter } from "next/router";
import { safeCapture } from "@/utils/safePosthog";
import HCaptcha from "@hcaptcha/react-hcaptcha";
import { reportSubmitLeadFormConversion } from "@/google/conversion";

interface QuoteRequestFormProps {
  country?: string;
  heading?: string;
  subtext?: string;
  buttonText?: string;
  successTitle?: string;
  successMessage?: string;
  formType?: "demo" | "pricing";
}

// Extracted Phone Input component to avoid inline component definition with matching styles
const PhoneInputField = (props: any) => (
  <Input
    {...props}
    size="md"
    bg="gray.50"
    border="1px solid"
    borderColor="gray.300"
    _hover={{ borderColor: "gray.400" }}
    _focus={{ borderColor: "blue.500", bg: "white" }}
  />
);

export default function QuoteRequestForm({
  country = "US",
  heading = "Request Pricing",
  subtext = "Fill out the form to speak with one of our specialists about your needs and receive a custom pricing estimate.",
  buttonText = "REQUEST QUOTE",
  successTitle = "Thank you for your request!",
  successMessage = "A member of our team will reach out to you shortly.",
  formType = "pricing",
}: QuoteRequestFormProps) {
  const toast = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const router = useRouter();
  const hasLoggedViewRef = useRef(false);
  const hasLoggedSuccessRef = useRef(false);
  const firstNameInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const hasAutoFocusedRef = useRef(false);
  const captchaRef = useRef<HCaptcha>(null);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    organizationName: "",
    websiteUrl: "",
    comments: "",
  });
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = "First name is required";
    }
    if (!formData.lastName.trim()) {
      newErrors.lastName = "Last name is required";
    }
    const trimmedEmail = formData.email.trim();
    if (!trimmedEmail) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      newErrors.email = "Please enter a valid email";
    }
    if (!formData.phone) {
      newErrors.phone = "Phone number is required";
    } else if (!isPossiblePhoneNumber(formData.phone)) {
      newErrors.phone = "Please enter a valid phone number";
    }
    if (!formData.organizationName.trim()) {
      newErrors.organizationName = "Organization name is required";
    }
    if (!captchaToken) {
      newErrors.captcha = "Please complete the captcha verification";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  useEffect(() => {
    if (!hasLoggedViewRef.current) {
      safeCapture("quote_request_form_viewed", {
        formType,
        route: router.pathname,
        heading,
      });
      hasLoggedViewRef.current = true;
    }
  }, [formType, heading, router.pathname]);

  // Auto-focus firstName input when form becomes visible at top of page
  useEffect(() => {
    if (isSubmitted || !firstNameInputRef.current || !formRef.current) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // If form is in viewport and near top, and we haven't auto-focused yet
          if (
            entry.isIntersecting &&
            entry.boundingClientRect.top < 200 &&
            !hasAutoFocusedRef.current
          ) {
            hasAutoFocusedRef.current = true;

            // Delay focus to ensure scroll animation completed
            setTimeout(() => {
              firstNameInputRef.current?.focus();
            }, 300);
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px" }
    );

    observer.observe(formRef.current);

    return () => observer.disconnect();
  }, [isSubmitted]);

  useEffect(() => {
    if (isSubmitted && !hasLoggedSuccessRef.current) {
      safeCapture("quote_request_form_success_viewed", {
        formType,
        route: router.pathname,
      });
      hasLoggedSuccessRef.current = true;
    }
  }, [formType, isSubmitted, router.pathname]);

  const normalizeWebsiteUrl = (url: string) => {
    if (!url.trim()) {
      return "";
    }
    return /^[a-zA-Z]+:\/\//.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    safeCapture("quote_request_form_submit_attempted", {
      formType,
      route: router.pathname,
    });
    const normalizedWebsiteUrl = normalizeWebsiteUrl(formData.websiteUrl);
    const payload = {
      ...formData,
      websiteUrl: normalizedWebsiteUrl,
      formType,
      hcaptchaToken: captchaToken,
    };
    try {
      const response = await fetch("/api/quote-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json();

        reportSubmitLeadFormConversion({
          email: formData.email,
          phoneNumber: formData.phone,
          firstName: formData.firstName,
          lastName: formData.lastName,
        });

        // Show success state
        setIsSubmitted(true);
        setCaptchaToken(null);
        safeCapture("quote_request_form_submit_succeeded", {
          formType,
          route: router.pathname,
        });
      } else {
        safeCapture("quote_request_form_submit_failed", {
          formType,
          route: router.pathname,
          status: response.status,
        });
        throw new Error("Failed to submit quote request");
      }
    } catch (error) {
      console.error("Error submitting quote request:", error);
      safeCapture("quote_request_form_submit_failed", {
        formType,
        route: router.pathname,
        status: "network_error",
      });
      toast({
        title: "Error",
        description: "Failed to submit quote request. Please try again.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
      // Reset captcha on error
      setCaptchaToken(null);
      captchaRef.current?.resetCaptcha();
    } finally {
      setIsLoading(false);
    }
  };

  // Success state
  if (isSubmitted) {
    return (
      <Fade in transition={{ enter: { duration: 0.5 } }}>
        <Box
          id="quote-request-form"
          w="full"
          bg="white"
          p={{ base: 5, md: 6 }}
          borderRadius="lg"
          boxShadow="md"
          border="1px solid"
          borderColor="gray.200"
          data-quote-request-form="true"
          tabIndex={-1}
        >
          <VStack spacing={6} align="center" py={4}>
            <ScaleFade in initialScale={0.9} transition={{ enter: { duration: 0.4 } }}>
              <Flex
                bg="rgba(239, 246, 255, 0.8)"
                p={4}
                borderRadius="full"
                border="2px solid"
                borderColor="rgba(59, 130, 246, 0.3)"
              >
                <FaCheckCircle color="#3B82F6" size={40} />
              </Flex>
            </ScaleFade>
            <VStack spacing={2}>
              <Text
                fontSize={{ base: "xl", md: "2xl" }}
                fontWeight="normal"
                fontFamily="Georgia, serif"
                color="gray.800"
                textAlign="center"
              >
                {successTitle}
              </Text>
              <Text fontSize="md" color="gray.600" textAlign="center">
                {successMessage}
              </Text>
            </VStack>
            <Button
              as="a"
              href="https://calendar.google.com/appointments/schedules/AcZssZ3PrLB5BhVDOrY0X103YzIQDStgx_P8FMesrwFb3gnCwo_mVoeMJchz1bsXZjRYavpNufULzE9J"
              target="_blank"
              rel="noopener noreferrer"
              leftIcon={<FaCalendarAlt size={20} />}
              w="full"
              size="md"
              bg="blue.500"
              color="white"
              fontWeight="medium"
              _hover={{
                "@media (hover: hover)": {
                  bg: "blue.600",
                },
              }}
              onClick={() =>
                safeCapture("quote_request_calendar_booking_clicked", {
                  formType,
                  route: router.pathname,
                })
              }
            >
              Book a slot now
            </Button>
          </VStack>
        </Box>
      </Fade>
    );
  }

  return (
    <Box
      ref={formRef}
      as="form"
      id="quote-request-form"
      onSubmit={handleSubmit}
      w="full"
      bg="white"
      p={{ base: 5, md: 6 }}
      borderRadius="lg"
      boxShadow="md"
      border="1px solid"
      borderColor="gray.200"
      data-quote-request-form="true"
      tabIndex={-1}
    >
      {/* Header Section */}
      <VStack spacing={2} align="flex-start" mb={4}>
        <Heading as="h3" size="md" color="gray.900" fontWeight="semibold">
          {heading}
        </Heading>
        <Text fontSize="xs" color="gray.600" lineHeight="1.6">
          {subtext}
        </Text>
      </VStack>

      <VStack spacing={3} align="stretch">
        {/* First Name and Last Name Row */}
        <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={3}>
          <FormControl isInvalid={!!errors.firstName}>
            <FormLabel fontSize="xs" fontWeight="medium" color="gray.700">
              First Name *
            </FormLabel>
            <Input
              ref={firstNameInputRef}
              type="text"
              name="firstName"
              value={formData.firstName}
              onChange={(e) => {
                setFormData({ ...formData, firstName: e.target.value });
                if (errors.firstName) {
                  setErrors({ ...errors, firstName: "" });
                }
              }}
              placeholder="John"
              size="md"
              bg="gray.50"
              border="1px solid"
              borderColor="gray.300"
              _hover={{ borderColor: "gray.400" }}
              _focus={{ borderColor: "blue.500", bg: "white" }}
            />
            {errors.firstName && (
              <FormErrorMessage fontSize="xs">{errors.firstName}</FormErrorMessage>
            )}
          </FormControl>

          <FormControl isInvalid={!!errors.lastName}>
            <FormLabel fontSize="xs" fontWeight="medium" color="gray.700">
              Last Name *
            </FormLabel>
            <Input
              type="text"
              name="lastName"
              value={formData.lastName}
              onChange={(e) => {
                setFormData({ ...formData, lastName: e.target.value });
                if (errors.lastName) {
                  setErrors({ ...errors, lastName: "" });
                }
              }}
              placeholder="Doe"
              size="md"
              bg="gray.50"
              border="1px solid"
              borderColor="gray.300"
              _hover={{ borderColor: "gray.400" }}
              _focus={{ borderColor: "blue.500", bg: "white" }}
            />
            {errors.lastName && (
              <FormErrorMessage fontSize="xs">{errors.lastName}</FormErrorMessage>
            )}
          </FormControl>
        </Grid>

        {/* Email - Full Row */}
        <FormControl isInvalid={!!errors.email}>
          <FormLabel fontSize="xs" fontWeight="medium" color="gray.700">
            Email *
          </FormLabel>
          <Input
            type="email"
            name="email"
            value={formData.email}
            onChange={(e) => {
              setFormData({ ...formData, email: e.target.value });
              if (errors.email) {
                setErrors({ ...errors, email: "" });
              }
            }}
            placeholder="you@example.com"
            size="md"
            bg="gray.50"
            border="1px solid"
            borderColor="gray.300"
            _hover={{ borderColor: "gray.400" }}
            _focus={{ borderColor: "blue.500", bg: "white" }}
          />
          {errors.email && <FormErrorMessage fontSize="xs">{errors.email}</FormErrorMessage>}
        </FormControl>

        {/* Phone Number - Full Row */}
        <FormControl isInvalid={!!errors.phone}>
          <FormLabel fontSize="xs" fontWeight="medium" color="gray.700">
            Phone Number *
          </FormLabel>
          <PhoneInput
            international
            defaultCountry={country as Country}
            value={formData.phone}
            onChange={(value) => setFormData({ ...formData, phone: value || "" })}
            inputComponent={PhoneInputField}
          />
          {errors.phone && <FormErrorMessage fontSize="xs">{errors.phone}</FormErrorMessage>}
        </FormControl>

        {/* Organization Name */}
        <FormControl isInvalid={!!errors.organizationName}>
          <FormLabel fontSize="xs" fontWeight="medium" color="gray.700">
            Organization Name *
          </FormLabel>
          <Input
            placeholder="Town of..."
            value={formData.organizationName}
            onChange={(e) => {
              setFormData({ ...formData, organizationName: e.target.value });
              if (errors.organizationName) {
                setErrors({ ...errors, organizationName: "" });
              }
            }}
            size="md"
            bg="gray.50"
            border="1px solid"
            borderColor="gray.300"
            _hover={{ borderColor: "gray.400" }}
            _focus={{ borderColor: "blue.500", bg: "white" }}
          />
          {errors.organizationName && (
            <FormErrorMessage fontSize="xs">{errors.organizationName}</FormErrorMessage>
          )}
        </FormControl>

        {/* Website URL */}
        <FormControl>
          <FormLabel fontSize="xs" fontWeight="medium" color="gray.700">
            Website URL (optional)
          </FormLabel>
          <Input
            type="text"
            placeholder="www.example.com"
            value={formData.websiteUrl}
            onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
            size="md"
            bg="gray.50"
            border="1px solid"
            borderColor="gray.300"
            _hover={{ borderColor: "gray.400" }}
            _focus={{ borderColor: "blue.500", bg: "white" }}
          />
        </FormControl>

        {/* Comments */}
        <FormControl>
          <FormLabel fontSize="xs" fontWeight="medium" color="gray.700">
            Comments (optional)
          </FormLabel>
          <Textarea
            placeholder="Tell us about your needs..."
            value={formData.comments}
            onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
            rows={3}
            resize="vertical"
            size="md"
            bg="gray.50"
            border="1px solid"
            borderColor="gray.300"
            _hover={{ borderColor: "gray.400" }}
            _focus={{ borderColor: "blue.500", bg: "white" }}
          />
        </FormControl>

        <Box display="flex" justifyContent="center" py={2}>
          <HCaptcha
            ref={captchaRef}
            sitekey={process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY!}
            onVerify={(token) => {
              setCaptchaToken(token);
              if (errors.captcha) {
                setErrors({ ...errors, captcha: "" });
              }
            }}
            onExpire={() => setCaptchaToken(null)}
            onError={() => setCaptchaToken(null)}
          />
        </Box>
        {errors.captcha && (
          <Text fontSize="xs" color="red.500" textAlign="center">
            {errors.captcha}
          </Text>
        )}

        {/* Privacy & Terms Disclaimer */}
        <Text fontSize="xs" color="gray.600" lineHeight="tall">
          By submitting this form, you agree to our{" "}
          <Link href="/privacy-policy.html" isExternal color="blue.600" textDecoration="underline">
            Privacy Policy
          </Link>{" "}
          and{" "}
          <Link href="/terms-of-use.html" isExternal color="blue.600" textDecoration="underline">
            Terms of Service
          </Link>
          .
        </Text>

        {/* Submit Button */}
        <Button
          type="submit"
          w="full"
          size="md"
          bg="#FF6B35"
          color="white"
          fontWeight="medium"
          isLoading={isLoading}
          _hover={{
            "@media (hover: hover)": {
              bg: "#E65A2E",
            },
          }}
        >
          {buttonText}
        </Button>
      </VStack>
    </Box>
  );
}
