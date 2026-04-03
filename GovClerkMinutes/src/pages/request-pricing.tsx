/**
 * Unified /request-pricing page.
 *
 * Lets visitors select between GovClerkMinutes and GovClerk Portal and
 * fills in the appropriate product-specific fields before submitting to
 * the correct API endpoint.
 *
 * Supports ?product=minutes or ?product=portal to pre-select the product.
 */

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/router";
import {
  Box,
  Button,
  Container,
  FormControl,
  FormLabel,
  Heading,
  Input,
  NumberInput,
  NumberInputField,
  Select,
  Text,
  Textarea,
  VStack,
  HStack,
  Alert,
  AlertIcon,
  AlertDescription,
  Stack,
  Icon,
} from "@chakra-ui/react";
import { CheckCircleIcon } from "@chakra-ui/icons";
import { NavBar } from "@/components/landing/NavBar";
import { Footer } from "@/components/landing/Footer";
import { GradientBackground } from "@/components/GradientBackground";
import MgHead from "@/components/MgHead";
import {
  ALLOWED_BILLING_DAYS,
  calculateProRata,
  formatZarAmount,
  ordinalSuffix,
} from "@/utils/portalBillingUtils";
import type { BillingDay } from "@/utils/portalBillingUtils";
import { PORTAL_PAYSTACK_PLANS } from "@/utils/portalPaystack";

// ─── Constants ────────────────────────────────────────────────────────────────

const BILLING_DAY_LABELS: Record<number, string> = {
  1: "1st of the month",
  15: "15th of the month",
  25: "25th of the month",
  26: "26th of the month",
  28: "28th of the month",
};

const PLAN_OPTIONS = [
  { value: "", label: "I'm not sure yet" },
  { value: "Starter", label: "Starter (R2,500/mo)" },
  { value: "Professional", label: "Professional (R8,000/mo)" },
  { value: "Enterprise", label: "Enterprise (R20,000+/mo)" },
] as const;

const PLAN_MONTHLY_PRICES: Record<string, number> = {
  Starter: PORTAL_PAYSTACK_PLANS.starter.monthly_zar,
  Professional: PORTAL_PAYSTACK_PLANS.professional.monthly_zar,
  Enterprise: PORTAL_PAYSTACK_PLANS.enterprise.monthly_zar,
};

// ─── Types ────────────────────────────────────────────────────────────────────

type Product = "minutes" | "portal";

interface FormState {
  // Common
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  organizationName: string;
  websiteUrl: string;
  // Minutes-specific
  meetingFrequency: string;
  teamSize: string;
  minutesComments: string;
  // Portal-specific
  selectedPlan: string;
  billingDay: string;
  estimatedSeats: string;
  estimatedStreamingHours: string;
  portalComments: string;
}

const INITIAL_FORM: FormState = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  organizationName: "",
  websiteUrl: "",
  meetingFrequency: "",
  teamSize: "",
  minutesComments: "",
  selectedPlan: "",
  billingDay: "",
  estimatedSeats: "",
  estimatedStreamingHours: "",
  portalComments: "",
};

const inputStyles = {
  bg: "gray.50",
  border: "1px solid",
  borderColor: "gray.300",
  _hover: { borderColor: "gray.400" },
  _focus: { borderColor: "blue.500", bg: "white" },
} as const;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RequestPricingPage() {
  const router = useRouter();
  const [product, setProduct] = useState<Product | "">("");
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Pre-select product from query param (?product=minutes or ?product=portal)
  useEffect(() => {
    const q = router.query.product;
    if (q === "minutes" || q === "portal") {
      setProduct(q);
    }
  }, [router.query.product]);

  // ── Billing preview (portal only) ─────────────────────────────────────────

  const billingPreview = useMemo<string | null>(() => {
    if (!form.selectedPlan || !form.billingDay) { return null; }
    const monthlyPrice = PLAN_MONTHLY_PRICES[form.selectedPlan];
    if (!monthlyPrice) { return null; }
    const billingDay = parseInt(form.billingDay, 10) as BillingDay;
    if (!(ALLOWED_BILLING_DAYS as readonly number[]).includes(billingDay)) { return null; }

    const { proRataAmountZar, firstBillingDate, daysRemaining, daysInMonth } = calculateProRata(
      new Date(),
      billingDay,
      monthlyPrice
    );

    const fullFormatted = formatZarAmount(monthlyPrice);
    const proRataFormatted = formatZarAmount(proRataAmountZar);

    if (daysRemaining === daysInMonth) {
      return `Your first charge will be ${fullFormatted} today, then ${fullFormatted}/month from the ${billingDay}${ordinalSuffix(billingDay)}.`;
    }

    const billingDateStr = firstBillingDate.toLocaleDateString("en-ZA", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    return `Your first charge will be ${proRataFormatted} today, then ${fullFormatted}/month from ${billingDateStr}.`;
  }, [form.selectedPlan, form.billingDay]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (product === "minutes") {
        const body = {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim().toLowerCase(),
          phone: form.phone.trim(),
          organizationName: form.organizationName.trim(),
          websiteUrl: form.websiteUrl.trim() || undefined,
          comments: [
            form.minutesComments.trim(),
            form.meetingFrequency ? `Meeting frequency: ${form.meetingFrequency}` : "",
            form.teamSize ? `Team size: ${form.teamSize}` : "",
          ]
            .filter(Boolean)
            .join("\n") || undefined,
          formType: "request-pricing" as const,
          product: "minutes",
        };

        const res = await fetch("/api/quote-request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error((data as { error?: string }).error || "Failed to submit request");
        }
      } else if (product === "portal") {
        const body = {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim().toLowerCase(),
          phone: form.phone.trim(),
          organizationName: form.organizationName.trim(),
          websiteUrl: form.websiteUrl.trim() || undefined,
          selectedPlan: form.selectedPlan || undefined,
          billingDay: form.billingDay ? parseInt(form.billingDay, 10) : undefined,
          estimatedSeats: form.estimatedSeats ? parseInt(form.estimatedSeats, 10) : undefined,
          estimatedStreamingHours: form.estimatedStreamingHours
            ? parseFloat(form.estimatedStreamingHours)
            : undefined,
          comments: form.portalComments.trim() || undefined,
          formType: "portal-quote",
        };

        const res = await fetch("/api/portal/quote-request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error((data as { error?: string }).error || "Failed to submit request");
        }
      }

      setSuccess(true);
    } catch (err) {
      setError((err as Error).message || "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const labelStyles = {
    fontSize: "sm" as const,
    fontWeight: "medium" as const,
    color: "gray.700",
  };

  return (
    <>
      <MgHead
        title="Request Pricing — GovClerk"
        description="Tell us about your organisation and we'll get back to you within 24 hours with a tailored quote for GovClerkMinutes or GovClerk Portal."
        canonical="https://GovClerkMinutes.com/request-pricing"
        keywords="GovClerk pricing, GovClerkMinutes quote, GovClerk Portal quote, meeting minutes pricing, public transparency portal pricing"
      />

      <Box position="relative" minH="100vh">
        <Box position="fixed" inset={0}>
          <GradientBackground />
        </Box>

        <Box position="relative" zIndex={1}>
          <NavBar />

          {/* Hero */}
          <Box as="section" pt={{ base: 24, md: 32 }} pb={{ base: 8, md: 12 }} textAlign="center">
            <Container maxW="2xl">
              <Heading
                as="h1"
                fontFamily="Georgia, serif"
                fontWeight="normal"
                fontSize={{ base: "3xl", md: "4xl" }}
                color="gray.800"
                mb={4}
              >
                Request Pricing
              </Heading>
              <Text fontSize={{ base: "md", md: "lg" }} color="gray.600" maxW="lg" mx="auto">
                Tell us about your organisation and we&rsquo;ll get back to you within 24 hours
                with a tailored quote.
              </Text>
            </Container>
          </Box>

          {/* Form card */}
          <Box as="section" pb={{ base: 16, md: 24 }}>
            <Container maxW="2xl">
              {success ? (
                <Box
                  bg="green.50"
                  border="1px solid"
                  borderColor="green.200"
                  borderRadius="2xl"
                  p={{ base: 8, md: 12 }}
                  textAlign="center"
                >
                  <Icon as={CheckCircleIcon} boxSize={12} color="green.500" mb={4} />
                  <Heading
                    as="h2"
                    fontFamily="Georgia, serif"
                    fontWeight="normal"
                    fontSize={{ base: "xl", md: "2xl" }}
                    color="green.800"
                    mb={2}
                  >
                    Request received!
                  </Heading>
                  <Text color="green.700">
                    Thank you! Our team will review your requirements and get back to you within 24
                    hours.
                  </Text>
                </Box>
              ) : (
                <Box
                  as="form"
                  onSubmit={handleSubmit}
                  bg="white"
                  border="1px solid"
                  borderColor="gray.200"
                  borderRadius="2xl"
                  boxShadow="sm"
                  p={{ base: 6, md: 10 }}
                >
                  <VStack spacing={6} align="stretch">
                    {/* Product selector */}
                    <FormControl isRequired>
                      <FormLabel {...labelStyles}>
                        Which product are you interested in?
                      </FormLabel>
                      <Select
                        value={product}
                        onChange={(e) => setProduct(e.target.value as Product | "")}
                        {...inputStyles}
                        required
                      >
                        <option value="">Select a product…</option>
                        <option value="minutes">GovClerkMinutes — AI Meeting Minutes</option>
                        <option value="portal">GovClerk Portal — Public Transparency Portal</option>
                      </Select>
                    </FormControl>

                    {/* Common fields — shown once a product is selected */}
                    {product && (
                      <>
                        <Stack direction={{ base: "column", sm: "row" }} spacing={4}>
                          <FormControl isRequired flex={1}>
                            <FormLabel {...labelStyles}>First Name</FormLabel>
                            <Input
                              name="firstName"
                              value={form.firstName}
                              onChange={handleChange}
                              placeholder="Jane"
                              {...inputStyles}
                              required
                            />
                          </FormControl>
                          <FormControl isRequired flex={1}>
                            <FormLabel {...labelStyles}>Last Name</FormLabel>
                            <Input
                              name="lastName"
                              value={form.lastName}
                              onChange={handleChange}
                              placeholder="Smith"
                              {...inputStyles}
                              required
                            />
                          </FormControl>
                        </Stack>

                        <Stack direction={{ base: "column", sm: "row" }} spacing={4}>
                          <FormControl isRequired flex={1}>
                            <FormLabel {...labelStyles}>Work Email</FormLabel>
                            <Input
                              name="email"
                              type="email"
                              value={form.email}
                              onChange={handleChange}
                              placeholder="jane@capetown.gov.za"
                              {...inputStyles}
                              required
                            />
                          </FormControl>
                          <FormControl isRequired flex={1}>
                            <FormLabel {...labelStyles}>Phone Number</FormLabel>
                            <Input
                              name="phone"
                              type="tel"
                              value={form.phone}
                              onChange={handleChange}
                              placeholder="+27 21 000 0000"
                              {...inputStyles}
                              required
                            />
                          </FormControl>
                        </Stack>

                        <Stack direction={{ base: "column", sm: "row" }} spacing={4}>
                          <FormControl isRequired flex={1}>
                            <FormLabel {...labelStyles}>Organisation Name</FormLabel>
                            <Input
                              name="organizationName"
                              value={form.organizationName}
                              onChange={handleChange}
                              placeholder="City of Cape Town"
                              {...inputStyles}
                              required
                            />
                          </FormControl>
                          <FormControl flex={1}>
                            <FormLabel {...labelStyles}>
                              Organisation Website{" "}
                              <Text as="span" color="gray.400" fontWeight="normal">
                                (optional)
                              </Text>
                            </FormLabel>
                            <Input
                              name="websiteUrl"
                              type="url"
                              value={form.websiteUrl}
                              onChange={handleChange}
                              placeholder="https://capetown.gov.za"
                              {...inputStyles}
                            />
                          </FormControl>
                        </Stack>

                        {/* ── GovClerkMinutes-specific fields ── */}
                        {product === "minutes" && (
                          <>
                            <FormControl>
                              <FormLabel {...labelStyles}>
                                How often does your team meet?{" "}
                                <Text as="span" color="gray.400" fontWeight="normal">
                                  (optional)
                                </Text>
                              </FormLabel>
                              <Select
                                name="meetingFrequency"
                                value={form.meetingFrequency}
                                onChange={handleChange}
                                {...inputStyles}
                              >
                                <option value="">Select frequency…</option>
                                <option value="Daily">Daily</option>
                                <option value="Several times a week">Several times a week</option>
                                <option value="Weekly">Weekly</option>
                                <option value="Bi-weekly">Bi-weekly</option>
                                <option value="Monthly">Monthly</option>
                                <option value="Ad hoc">Ad hoc</option>
                              </Select>
                            </FormControl>

                            <FormControl>
                              <FormLabel {...labelStyles}>
                                How many people need access?{" "}
                                <Text as="span" color="gray.400" fontWeight="normal">
                                  (optional)
                                </Text>
                              </FormLabel>
                              <Select
                                name="teamSize"
                                value={form.teamSize}
                                onChange={handleChange}
                                {...inputStyles}
                              >
                                <option value="">Select team size…</option>
                                <option value="Just me">Just me</option>
                                <option value="2–5">2–5</option>
                                <option value="6–15">6–15</option>
                                <option value="16–50">16–50</option>
                                <option value="50+">50+</option>
                              </Select>
                            </FormControl>

                            <FormControl>
                              <FormLabel {...labelStyles}>
                                Comments / Additional Requirements{" "}
                                <Text as="span" color="gray.400" fontWeight="normal">
                                  (optional)
                                </Text>
                              </FormLabel>
                              <Textarea
                                name="minutesComments"
                                value={form.minutesComments}
                                onChange={handleChange}
                                rows={4}
                                placeholder="Any specific requirements, integrations, or questions…"
                                {...inputStyles}
                                resize="vertical"
                              />
                            </FormControl>
                          </>
                        )}

                        {/* ── GovClerk Portal-specific fields ── */}
                        {product === "portal" && (
                          <>
                            <FormControl>
                              <FormLabel {...labelStyles}>
                                Preferred Plan{" "}
                                <Text as="span" color="gray.400" fontWeight="normal">
                                  (optional)
                                </Text>
                              </FormLabel>
                              <Select
                                name="selectedPlan"
                                value={form.selectedPlan}
                                onChange={handleChange}
                                {...inputStyles}
                              >
                                {PLAN_OPTIONS.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </Select>
                            </FormControl>

                            <FormControl>
                              <FormLabel {...labelStyles}>
                                Preferred Billing Day{" "}
                                <Text as="span" color="gray.400" fontWeight="normal">
                                  (optional)
                                </Text>
                              </FormLabel>
                              <Select
                                name="billingDay"
                                value={form.billingDay}
                                onChange={handleChange}
                                {...inputStyles}
                              >
                                <option value="">Select a billing day</option>
                                {ALLOWED_BILLING_DAYS.map((day) => (
                                  <option key={day} value={day}>
                                    {BILLING_DAY_LABELS[day]}
                                  </option>
                                ))}
                              </Select>
                              {billingPreview && (
                                <Box
                                  mt={2}
                                  px={3}
                                  py={2}
                                  border="1px solid"
                                  borderColor="green.200"
                                  bg="green.50"
                                  borderRadius="lg"
                                >
                                  <Text fontSize="sm" color="green.800">
                                    💳 {billingPreview}
                                  </Text>
                                </Box>
                              )}
                            </FormControl>

                            <Stack direction={{ base: "column", sm: "row" }} spacing={4}>
                              <FormControl flex={1}>
                                <FormLabel {...labelStyles}>
                                  Number of Admin Seats{" "}
                                  <Text as="span" color="gray.400" fontWeight="normal">
                                    (optional)
                                  </Text>
                                </FormLabel>
                                <NumberInput min={1}>
                                  <NumberInputField
                                    name="estimatedSeats"
                                    value={form.estimatedSeats}
                                    onChange={handleChange}
                                    placeholder="e.g. 10"
                                    {...inputStyles}
                                  />
                                </NumberInput>
                              </FormControl>
                              <FormControl flex={1}>
                                <FormLabel {...labelStyles}>
                                  Est. Monthly Streaming Hours{" "}
                                  <Text as="span" color="gray.400" fontWeight="normal">
                                    (optional)
                                  </Text>
                                </FormLabel>
                                <NumberInput min={0} step={0.5}>
                                  <NumberInputField
                                    name="estimatedStreamingHours"
                                    value={form.estimatedStreamingHours}
                                    onChange={handleChange}
                                    placeholder="e.g. 8"
                                    {...inputStyles}
                                  />
                                </NumberInput>
                              </FormControl>
                            </Stack>

                            <FormControl>
                              <FormLabel {...labelStyles}>
                                Comments / Additional Requirements{" "}
                                <Text as="span" color="gray.400" fontWeight="normal">
                                  (optional)
                                </Text>
                              </FormLabel>
                              <Textarea
                                name="portalComments"
                                value={form.portalComments}
                                onChange={handleChange}
                                rows={4}
                                placeholder="Any specific requirements, integrations, or questions…"
                                {...inputStyles}
                                resize="vertical"
                              />
                            </FormControl>
                          </>
                        )}

                        {/* Error */}
                        {error && (
                          <Alert status="error" borderRadius="lg">
                            <AlertIcon />
                            <AlertDescription>{error}</AlertDescription>
                          </Alert>
                        )}

                        {/* Submit */}
                        <VStack spacing={3} align="stretch">
                          <Button
                            type="submit"
                            w="full"
                            bg="blue.500"
                            color="white"
                            size="lg"
                            fontWeight="medium"
                            isLoading={isSubmitting}
                            loadingText="Submitting…"
                            _hover={{ bg: "blue.600" }}
                            _active={{ bg: "blue.700" }}
                          >
                            Request Pricing
                          </Button>
                          <Text fontSize="xs" color="gray.400" textAlign="center">
                            We typically respond within 24 hours. View our{" "}
                            <Text
                              as="a"
                              href="/privacy-policy.html"
                              textDecoration="underline"
                              _hover={{ color: "gray.700" }}
                            >
                              Privacy Policy
                            </Text>
                            .
                          </Text>
                        </VStack>
                      </>
                    )}
                  </VStack>
                </Box>
              )}
            </Container>
          </Box>

          <Footer />
        </Box>
      </Box>
    </>
  );
}
