import React from "react";
import { Box, Container, Heading, Text, VStack, Grid } from "@chakra-ui/react";
import Image from "next/image";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/router";
import { safeCapture } from "@/utils/safePosthog";
import QuoteRequestForm from "@/components/landing/QuoteRequestForm";

interface PricingHeroSectionProps {
  country: string | null;
}

export const PricingHeroSection = ({ country }: PricingHeroSectionProps) => {
  const router = useRouter();
  const { isLoaded, userId } = useAuth();

  return (
    <Box
      as="section"
      position="relative"
      minH="100vh"
      display="flex"
      alignItems="center"
      pt={{ base: 24, md: 32 }}
      pb={{ base: 16, md: 24 }}
      onMouseEnter={() => {
        safeCapture("new_landing_page_section_seen", {
          section: "pricing_hero",
          variant: "v2",
        });
      }}
      overflow="hidden"
    >
      {/* Background */}
      <Box position="absolute" top={0} left={0} right={0} bottom={0} bg="white" />

      <Container maxW="7xl" position="relative" zIndex={1}>
        {/* Mobile: Vertical Stack */}
        <VStack spacing={6} display={{ base: "flex", md: "none" }}>
          {/* Content */}
          <VStack spacing={4} textAlign="center" w="full">
            <Heading
              as="h1"
              fontSize={{ base: "3xl", sm: "4xl" }}
              lineHeight="1.5"
              fontWeight="normal"
              fontFamily="Georgia, serif"
              color="gray.700"
              mt={6}
            >
              Request Custom Pricing from{" "}
              <Box as="span" bg="yellow.100" px={3} py={1} borderRadius="md">
                GovClerkMinutes
              </Box>
            </Heading>

            <Text fontSize="md" color="gray.600" lineHeight="1.8">
              Our modern meeting minutes platform powers and empowers local governments to create
              efficient, automated, and professional meeting documentation. From AI-powered
              transcription to secure cloud hosting, transform how you manage meeting minutes.
            </Text>
          </VStack>

          {/* Form - Last on Mobile */}
          <QuoteRequestForm
            country={country ?? "US"}
            heading="Request Pricing"
            subtext="Tell us about your team's needs and we'll send a customized quote."
            buttonText="REQUEST PRICING"
            successTitle="Quote request received!"
            successMessage="We'll reach out shortly with custom pricing."
            formType="pricing"
          />

          {/* Mobile Screenshot */}
          <Box maxW="600px" mx="auto" borderRadius="2xl" overflow="hidden" w="full">
            <Image
              src="/screenshots/mobile-v2.png"
              alt="GovClerkMinutes Mobile Dashboard"
              width={600}
              height={800}
              style={{ width: "100%", height: "auto" }}
            />
          </Box>
        </VStack>

        {/* Desktop: 2-Column Layout (60% / 40%) */}
        <Grid
          templateColumns="60% 40%"
          gap={12}
          display={{ base: "none", md: "grid" }}
          alignItems="start"
          px={8}
        >
          {/* Left Column: Content */}
          <VStack spacing={6} align="flex-start" textAlign="left" pr={8}>
            <Heading
              as="h1"
              fontSize="clamp(1.65rem, 4.2vw, 3rem)"
              lineHeight="1.3"
              fontWeight="normal"
              fontFamily="Georgia, serif"
              color="gray.700"
              mt={6}
            >
              Request Custom Pricing from{" "}
              <Box as="span" bg="yellow.100" px={3} py={1} borderRadius="md">
                GovClerkMinutes
              </Box>
            </Heading>

            <Text fontSize="clamp(0.95rem, 1.425vw, 1.19rem)" color="gray.600" lineHeight="1.8">
              Our modern meeting minutes platform powers and empowers local governments to create
              efficient, automated, and professional meeting documentation. From AI-powered
              transcription to secure cloud hosting, transform how you manage meeting minutes.
            </Text>
          </VStack>

          {/* Right Column: Form */}
          <Box position="sticky" top="20px" px={4}>
            <QuoteRequestForm country={country ?? "US"} />
          </Box>
        </Grid>
      </Container>
    </Box>
  );
};
