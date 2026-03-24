import React from "react";
import { Box, Container, Heading, Text, VStack, Grid } from "@chakra-ui/react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/router";
import { safeCapture } from "@/utils/safePosthog";
import QuoteRequestForm from "@/components/landing/QuoteRequestForm";

interface DemoHeroSectionProps {
  country: string | null;
}

export const DemoHeroSection = ({ country }: DemoHeroSectionProps) => {
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
          section: "demo_hero",
          variant: "v2",
        });
      }}
      overflow="hidden"
    >
      {/* Background */}
      <Box
        position="absolute"
        top={0}
        left={0}
        right={0}
        bottom={0}
        bg="white"
      />

      <Container maxW="7xl" position="relative" zIndex={1}>
        {/* Mobile: Vertical Stack */}
        <VStack spacing={{ base: 6, md: 0 }} display={{ base: "flex", md: "none" }}>
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
              See How It Works
            </Heading>

            <Text fontSize="md" color="gray.600" lineHeight="1.8">
              Schedule a personalized demo with our team to discover how GovClerkMinutes can
              transform your meeting documentation process. See our AI-powered platform in action
              and get answers to all your questions.
            </Text>
          </VStack>

          {/* Form - Last on Mobile */}
          <QuoteRequestForm
            country={country ?? "US"}
            heading="Book a Demo"
            subtext="Fill out the form and we'll schedule a personalized demo at your convenience."
            buttonText="BOOK A DEMO"
            successTitle="Demo request received!"
            successMessage="We'll reach out shortly to schedule your personalized demo."
            formType="demo"
          />
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
              See How It Works
            </Heading>

            <Text fontSize="clamp(0.95rem, 1.425vw, 1.19rem)" color="gray.600" lineHeight="1.8">
              Schedule a personalized demo with our team to discover how GovClerkMinutes can
              transform your meeting documentation process. See our AI-powered platform in action
              and get answers to all your questions.
            </Text>
          </VStack>

          {/* Right Column: Form */}
          <Box position="sticky" top="20px" px={4}>
            <QuoteRequestForm
              country={country ?? "US"}
              heading="Book a Demo"
              subtext="Fill out the form and we'll schedule a personalized demo at your convenience."
              buttonText="BOOK A DEMO"
              successTitle="Demo request received!"
              successMessage="We'll reach out shortly to schedule your personalized demo."
              formType="demo"
            />
          </Box>
        </Grid>
      </Container>
    </Box>
  );
};
