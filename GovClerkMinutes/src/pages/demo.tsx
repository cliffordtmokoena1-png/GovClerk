import { useState, useEffect } from "react";
import { Box, VStack } from "@chakra-ui/react";
import { NavBar } from "@/components/landing/NavBar";
import { DemoHeroSection } from "@/components/landing/sections/DemoHeroSection";
import { CompanyCarousel } from "@/components/landing/sections/CompanyCarousel";
import { FeaturesSection } from "@/components/landing/GovClerk/GovClerkFeaturesSection";
import { HowItWorksSection } from "@/components/landing/sections/HowItWorksSection";
import { TestimonialsSection } from "@/components/landing/GovClerk/GovClerkTestimonialsSection";
import { LetterSection } from "@/components/landing/sections/LetterSection";
import { FaqSection } from "@/components/landing/GovClerk/GovClerkFaqSection";
import { CtaSection } from "@/components/landing/GovClerk/GovClerkCtaSection";
import { Footer } from "@/components/landing/Footer";
import { GradientBackground } from "@/components/GradientBackground";
import MgHead from "@/components/MgHead";
import { getPersonalizationFromCookies } from "@/utils/landing/landingUtils";

export default function DemoPage() {
  const [country, setCountry] = useState<string | null>(null);

  useEffect(() => {
    const { country } = getPersonalizationFromCookies();
    setCountry(country);
  }, []);

  return (
    <>
      <MgHead
        title="Book a Demo - GovClerkMinutes | See Our AI Meeting Minutes Platform in Action"
        description="Schedule a personalized demo to see how GovClerkMinutes transforms meeting documentation with AI-powered transcription and professional minutes generation."
        canonical="https://GovClerkMinutes.com/demo"
        keywords="meeting minutes demo, AI transcription demo, schedule demo, product demo, meeting software demo"
      />

      <Box position="relative" minH="100vh">
        <Box position="fixed" inset={0}>
          <GradientBackground />
        </Box>

        <Box position="relative" zIndex={1}>
          <NavBar />

          <VStack spacing={0} align="stretch">
            <DemoHeroSection country={country} />
            <CompanyCarousel />
            <FeaturesSection />
            <HowItWorksSection />
            <TestimonialsSection />
            <LetterSection />
            <FaqSection />
            <CtaSection />
          </VStack>

          <Footer />
        </Box>
      </Box>
    </>
  );
}
