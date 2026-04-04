import { useState } from "react";
import {
  Box,
  Button,
  Container,
  Grid,
  GridItem,
  Heading,
  Text,
  VStack,
  HStack,
  Badge,
  Icon,
  Divider,
} from "@chakra-ui/react";
import Link from "next/link";
import { FaCheck } from "react-icons/fa";
import { NavBar } from "@/components/landing/NavBar";
import { CompanyCarousel } from "@/components/landing/sections/CompanyCarousel";
import { TestimonialsSection } from "@/components/landing/GovClerk/GovClerkTestimonialsSection";
import { FaqSection } from "@/components/landing/GovClerk/GovClerkFaqSection";
import { CtaSection } from "@/components/landing/GovClerk/GovClerkCtaSection";
import { PricingComparisonTable } from "@/components/landing/PricingComparisonTable";
import { Footer } from "@/components/landing/Footer";
import { GradientBackground } from "@/components/GradientBackground";
import MgHead from "@/components/MgHead";
import { safeCapture } from "@/utils/safePosthog";

type BillingPeriod = "monthly" | "annual";

interface Plan {
  name: string;
  basePlan: string;
  monthlyPrice: number;
  annualPrice: number;
  effectiveMonthly: number;
  annualSavings: number;
  tokens: number;
  hoursApprox: string;
  popular?: boolean;
  features: string[];
  ctaLabel: string;
}

const PLANS: Plan[] = [
  {
    name: "Essential",
    basePlan: "Essential",
    monthlyPrice: 300,
    annualPrice: 3000,
    effectiveMonthly: 250,
    annualSavings: 600,
    tokens: 400,
    hoursApprox: "~6.7 hrs",
    features: [
      "400 tokens/month (~6.7 hours of audio)",
      "AI Meeting Minutes Generation",
      "Transcript Generation",
      "Export to Word & PDF",
      "Mobile Web App (PWA)",
      "AI Summary & Key Points",
      "Action Items Extraction",
      "96+ languages supported",
      "Edit & Format Minutes",
      "Upload Audio, Video & Images",
      "Template Library",
      "Built-in Recorder & Save Recordings",
      "14-day money-back guarantee",
      "Basic support",
    ],
    ctaLabel: "Get Started",
  },
  {
    name: "Professional",
    basePlan: "Professional",
    monthlyPrice: 450,
    annualPrice: 4500,
    effectiveMonthly: 375,
    annualSavings: 900,
    tokens: 1000,
    hoursApprox: "~16.7 hrs",
    popular: true,
    features: [
      "1,000 tokens/month (~16.7 hours of audio)",
      "Everything in Essential, plus:",
      "Cross-meeting Speaker Recognition",
      "Create Template from Example",
      "Priority support",
    ],
    ctaLabel: "Get Started",
  },
  {
    name: "Elite",
    basePlan: "Elite",
    monthlyPrice: 600,
    annualPrice: 6000,
    effectiveMonthly: 500,
    annualSavings: 1200,
    tokens: 1600,
    hoursApprox: "~26.7 hrs",
    features: [
      "1,600 tokens/month (~26.7 hours of audio)",
      "Everything in Professional, plus:",
      "Higher monthly usage capacity",
    ],
    ctaLabel: "Get Started",
  },
  {
    name: "Premium",
    basePlan: "Premium",
    monthlyPrice: 900,
    annualPrice: 8100,
    effectiveMonthly: 675,
    annualSavings: 1800,
    tokens: 2300,
    hoursApprox: "~38.3 hrs",
    features: [
      "2,300 tokens/month (~38.3 hours of audio)",
      "Everything in Elite, plus:",
      "Custom Volume options",
      "Dedicated Account Manager",
      "Priority + Chat support",
    ],
    ctaLabel: "Get Started",
  },
];

function BillingToggle({
  value,
  onChange,
}: {
  value: BillingPeriod;
  onChange: (v: BillingPeriod) => void;
}) {
  return (
    <HStack
      spacing={0}
      bg="gray.100"
      borderRadius="full"
      p={1}
      display="inline-flex"
    >
      {(["monthly", "annual"] as BillingPeriod[]).map((period) => (
        <Button
          key={period}
          size="sm"
          borderRadius="full"
          px={6}
          bg={value === period ? "white" : "transparent"}
          color={value === period ? "gray.800" : "gray.500"}
          boxShadow={value === period ? "sm" : "none"}
          fontWeight={value === period ? "semibold" : "medium"}
          _hover={{ bg: value === period ? "white" : "gray.200" }}
          onClick={() => onChange(period)}
          transition="all 0.2s"
        >
          {period === "monthly" ? "Monthly" : "Annual"}
          {period === "annual" && (
            <Badge ml={2} colorScheme="green" borderRadius="full" fontSize="xs">
              Save up to 17%
            </Badge>
          )}
        </Button>
      ))}
    </HStack>
  );
}

function PlanCard({
  plan,
  billing,
}: {
  plan: Plan;
  billing: BillingPeriod;
}) {
  const isAnnual = billing === "annual";
  const price = isAnnual ? plan.effectiveMonthly : plan.monthlyPrice;
  const planKey = isAnnual ? `${plan.basePlan}_Annual` : plan.basePlan;
  const href = `/subscribe/ZA?plan=${planKey}`;

  return (
    <Box
      position="relative"
      bg="white"
      borderRadius="2xl"
      border="2px solid"
      borderColor={plan.popular ? "blue.500" : "gray.200"}
      boxShadow={plan.popular ? "xl" : "sm"}
      p={8}
      display="flex"
      flexDirection="column"
      transition="box-shadow 0.2s, transform 0.2s"
      _hover={{ boxShadow: "xl", transform: "translateY(-2px)" }}
    >
      {plan.popular && (
        <Badge
          position="absolute"
          top="-14px"
          left="50%"
          transform="translateX(-50%)"
          colorScheme="blue"
          borderRadius="full"
          px={4}
          py={1}
          fontSize="xs"
          fontWeight="bold"
          textTransform="uppercase"
          letterSpacing="wide"
          boxShadow="md"
        >
          Most Popular
        </Badge>
      )}

      <VStack align="start" spacing={1} mb={6}>
        <Text fontSize="xl" fontWeight="bold" color="gray.900">
          {plan.name}
        </Text>
        <HStack align="baseline" spacing={1}>
          <Text fontSize="4xl" fontWeight="bold" color="gray.900" lineHeight="1">
            R{price}
          </Text>
          <Text fontSize="sm" color="gray.500">
            /month
          </Text>
        </HStack>
        {isAnnual && (
          <Text fontSize="xs" color="gray.400">
            R{plan.annualPrice}/year · Save R{plan.annualSavings}
          </Text>
        )}
        {!isAnnual && (
          <Text fontSize="xs" color="gray.400">
            Or R{plan.effectiveMonthly}/mo billed annually
          </Text>
        )}
      </VStack>

      <Divider mb={6} />

      <VStack align="start" spacing={3} flex={1} mb={8}>
        {plan.features.map((feature) => (
          <HStack key={feature} align="start" spacing={3}>
            <Icon as={FaCheck} color="green.500" mt={0.5} boxSize={3.5} flexShrink={0} />
            <Text fontSize="sm" color="gray.700" lineHeight="short">
              {feature}
            </Text>
          </HStack>
        ))}
      </VStack>

      <Button
        as={Link}
        href={href}
        size="md"
        w="full"
        bg={plan.popular ? "blue.500" : "white"}
        color={plan.popular ? "white" : "gray.700"}
        border="1px solid"
        borderColor={plan.popular ? "blue.500" : "gray.300"}
        borderRadius="lg"
        fontWeight="semibold"
        transition="all 0.2s"
        _hover={{
          bg: plan.popular ? "blue.600" : "gray.50",
          boxShadow: "md",
        }}
        onClick={() =>
          safeCapture("pricing_plan_cta_clicked", {
            plan: planKey,
            billing,
          })
        }
      >
        {plan.ctaLabel}
      </Button>
    </Box>
  );
}

function PricingHero({
  billing,
  onBillingChange,
}: {
  billing: BillingPeriod;
  onBillingChange: (v: BillingPeriod) => void;
}) {
  return (
    <Box
      as="section"
      bg="white"
      pt={{ base: 28, md: 36 }}
      pb={{ base: 16, md: 24 }}
    >
      <Container maxW="7xl">
        <VStack spacing={10} textAlign="center">
          <VStack spacing={4}>
            <Heading
              as="h1"
              fontSize={{ base: "3xl", md: "4xl", lg: "5xl" }}
              fontWeight="normal"
              fontFamily="Georgia, serif"
              color="gray.800"
              lineHeight="1.2"
            >
              Simple, transparent pricing
            </Heading>
            <Text
              fontSize={{ base: "md", md: "lg" }}
              color="gray.600"
              maxW="2xl"
              lineHeight="1.8"
            >
              All plans include AI transcription, automated minutes, and secure cloud storage.
              No setup fees. Cancel anytime.
            </Text>
          </VStack>

          <BillingToggle value={billing} onChange={onBillingChange} />

          <Grid
            templateColumns={{ base: "1fr", md: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" }}
            gap={6}
            w="full"
            alignItems="start"
          >
            {PLANS.map((plan) => (
              <GridItem key={plan.name}>
                <PlanCard plan={plan} billing={billing} />
              </GridItem>
            ))}
          </Grid>

          <Text fontSize="sm" color="gray.400">
            All prices in South African Rand (ZAR) · 14-day money-back guarantee on all plans
          </Text>
        </VStack>
      </Container>
    </Box>
  );
}

export default function PricingPage() {
  const [billing, setBilling] = useState<BillingPeriod>("monthly");

  return (
    <>
      <MgHead
        title="Pricing - GovClerkMinutes | Affordable AI Meeting Minutes Plans"
        description="Choose the perfect plan for your meeting minutes needs. From Essential to Premium, get AI-powered transcription and professional minutes at transparent prices."
        canonical="https://GovClerkMinutes.com/pricing"
        keywords="meeting minutes pricing, transcription plans, AI minutes cost, meeting software pricing, professional minutes subscription"
      />

      <Box position="relative" minH="100vh">
        <Box position="fixed" inset={0}>
          <GradientBackground />
        </Box>

        <Box position="relative" zIndex={1}>
          <NavBar />

          <VStack spacing={0} align="stretch">
            <PricingHero billing={billing} onBillingChange={setBilling} />
            <CompanyCarousel />
            <PricingComparisonTable />
            <TestimonialsSection />
            <FaqSection />
            <CtaSection />
          </VStack>

          <Footer />
        </Box>
      </Box>
    </>
  );
}
