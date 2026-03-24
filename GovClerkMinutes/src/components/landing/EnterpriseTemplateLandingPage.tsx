import { Box, VStack } from "@chakra-ui/react";
import { NavBar } from "./NavBar";
import { EnterpriseHeroSection } from "./sections/EnterpriseHeroSection";
import { CompanyCarousel } from "./sections/CompanyCarousel";
import { FeaturesSection } from "./GovClerk/GovClerkFeaturesSection";
import { HowItWorksSection } from "./sections/HowItWorksSection";
import { LetterSection } from "./sections/LetterSection";
import { TestimonialsSection } from "./GovClerk/GovClerkTestimonialsSection";
import { TalkToSalesSection } from "./sections/TalkToSalesSection";
import { FaqSection } from "./GovClerk/GovClerkFaqSection";
import { CtaSection } from "./GovClerk/GovClerkCtaSection";
import { Footer } from "./Footer";
import { GradientBackground } from "../GradientBackground";
import { LandingPageContent } from "@/types/landingPage";

type Props = Readonly<{
  content: LandingPageContent;
  country: string | null;
}>;

export default function EnterpriseTemplateLandingPage({ content, country }: Props) {
  return (
    <Box position="relative" minH="100vh">
      <Box position="fixed" inset={0}>
        <GradientBackground />
      </Box>

      <Box position="relative" zIndex={1}>
        <NavBar />

        <VStack spacing={0} align="stretch">
          <EnterpriseHeroSection
            title={content.hero.title}
            subtitle={content.hero.subtitle}
            subheadline={content.hero.subheadline}
            image={content.hero.image}
            mobileImage={content.hero.mobileImage}
            country={country}
          />
          <CompanyCarousel />
          <FeaturesSection
            customFeatures={content.features}
            customHeading={content.featuresHeading}
          />
          <HowItWorksSection />
          <TestimonialsSection />
          <LetterSection />
          <TalkToSalesSection />
          <FaqSection />
          <CtaSection />
        </VStack>

        <Footer />
      </Box>
    </Box>
  );
}
