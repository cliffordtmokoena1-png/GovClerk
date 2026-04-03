import {
  Box,
  Button,
  Container,
  Grid,
  Heading,
  Text,
  VStack,
} from "@chakra-ui/react";
import Link from "next/link";
import { NavBar } from "@/components/landing/NavBar";
import { CompanyCarousel } from "@/components/landing/sections/CompanyCarousel";
import { TestimonialsSection } from "@/components/landing/GovClerk/GovClerkTestimonialsSection";
import { FaqSection } from "@/components/landing/GovClerk/GovClerkFaqSection";
import { CtaSection } from "@/components/landing/GovClerk/GovClerkCtaSection";
import { Footer } from "@/components/landing/Footer";
import { GradientBackground } from "@/components/GradientBackground";
import MgHead from "@/components/MgHead";

const PLANS = [
  { name: "Essential", monthly: "R300/mo", annual: "R3,000/yr", tokens: "400 tokens" },
  { name: "Professional", monthly: "R450/mo", annual: "R4,500/yr", tokens: "1,000 tokens" },
  { name: "Elite", monthly: "R600/mo", annual: "R6,000/yr", tokens: "1,600 tokens" },
  { name: "Premium", monthly: "R900/mo", annual: "R8,100/yr", tokens: "2,300 tokens" },
];

function PricingSimpleHero() {
  return (
    <Box
      as="section"
      bg="white"
      pt={{ base: 24, md: 32 }}
      pb={{ base: 16, md: 24 }}
    >
      <Container maxW="7xl">
        <VStack spacing={6} textAlign="center">
          <Heading
            as="h1"
            fontSize={{ base: "3xl", md: "4xl", lg: "5xl" }}
            fontWeight="normal"
            fontFamily="Georgia, serif"
            color="gray.700"
            lineHeight="1.3"
          >
            Simple, transparent pricing for GovClerkMinutes
          </Heading>

          <Text
            fontSize={{ base: "md", md: "lg" }}
            color="gray.600"
            maxW="2xl"
            lineHeight="1.8"
          >
            Choose the plan that fits your team. From essential to premium — all plans include AI
            transcription, automated minutes, and secure cloud storage.
          </Text>

          <Grid
            templateColumns={{ base: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" }}
            gap={4}
            w="full"
            mt={4}
          >
            {PLANS.map((plan) => (
              <Box
                key={plan.name}
                border="1px solid"
                borderColor="gray.200"
                borderRadius="xl"
                p={6}
                bg="white"
                textAlign="center"
                transition="box-shadow 0.2s"
                _hover={{ boxShadow: "md" }}
              >
                <Text fontWeight="semibold" fontSize="lg" color="gray.700" mb={2}>
                  {plan.name}
                </Text>
                <Text fontSize="2xl" fontWeight="bold" color="blue.500" lineHeight="1.1">
                  {plan.monthly}
                </Text>
                <Text fontSize="sm" color="gray.500" mb={3}>
                  {plan.annual} · billed monthly or annually
                </Text>
                <Text fontSize="sm" color="gray.600" fontWeight="medium">
                  {plan.tokens}
                </Text>
              </Box>
            ))}
          </Grid>

          <Button
            as={Link}
            href="/request-pricing"
            size="lg"
            colorScheme="blue"
            bg="blue.500"
            color="white"
            px={10}
            mt={4}
            _hover={{ bg: "blue.600" }}
          >
            Request Pricing →
          </Button>
        </VStack>
      </Container>
    </Box>
  );
}

export default function PricingPage() {
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
            <PricingSimpleHero />
            <CompanyCarousel />
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
