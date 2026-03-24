import { Box, VStack } from "@chakra-ui/react";
import { NavBar } from "./NavBar";
import { HeroSection } from "./GovClerk/GovClerkHeroSection";
import { CompanyCarousel } from "./sections/CompanyCarousel";
import { FeaturesSection } from "./GovClerk/GovClerkFeaturesSection";
import { HowItWorksSection } from "./sections/HowItWorksSection";
import { LetterSection } from "./sections/LetterSection";
import { TestimonialsSection } from "./GovClerk/GovClerkTestimonialsSection";
import { FaqSection } from "./GovClerk/GovClerkFaqSection";
import { CtaSection } from "./GovClerk/GovClerkCtaSection";
import { Footer } from "./Footer";
import { GradientBackground } from "../GradientBackground";

type Props = {
  country: string | null;
};

export default function LandingPage({ country }: Props) {
  return (
    <Box position="relative" minH="100vh">
      <Box position="fixed" inset={0}>
        <GradientBackground />
      </Box>

      <Box position="relative" zIndex={1}>
        <NavBar />

        <VStack spacing={0} align="stretch">
          <HeroSection country={country} />
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
  );
}
