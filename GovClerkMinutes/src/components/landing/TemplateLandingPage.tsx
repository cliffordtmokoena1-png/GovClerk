import { Box, VStack } from "@chakra-ui/react";
import { NavBar } from "./NavBar";
import { TemplateHeroSection } from "./sections/TemplateHeroSection";
import { CompanyCarousel } from "./sections/CompanyCarousel";
import { FeaturesSection } from "./GovClerk/GovClerkFeaturesSection";
import { HowItWorksSection } from "./sections/HowItWorksSection";
import { LetterSection } from "./sections/LetterSection";
import { TestimonialsSection } from "./GovClerk/GovClerkTestimonialsSection";
import { FaqSection } from "./GovClerk/GovClerkFaqSection";
import { CtaSection } from "./GovClerk/GovClerkCtaSection";
import { Footer } from "./Footer";
import { GradientBackground } from "../GradientBackground";
import { LandingPageContent } from "@/types/landingPage";

type Props = Readonly<{
  content: LandingPageContent;
  country: string | null;
}>;

export default function TemplateLandingPage({ content, country }: Props) {
  // Only use custom features for actual template pages (those with templatePreview)
  // Use case pages like HOA, nonprofit, board meeting minutes should use standard features
  const isTemplatePage = !!content.hero.templatePreview;

  return (
    <Box position="relative" minH="100vh">
      <Box position="fixed" inset={0}>
        <GradientBackground />
      </Box>

      <Box position="relative" zIndex={1}>
        <NavBar />

        <VStack spacing={0} align="stretch">
          <TemplateHeroSection
            title={content.hero.title}
            subtitle={content.hero.subtitle}
            subheadline={content.hero.subheadline}
            image={content.hero.image}
            mobileImage={content.hero.mobileImage}
            country={country}
            templatePreview={content.hero.templatePreview}
          />
          <CompanyCarousel />
          <FeaturesSection
            customFeatures={isTemplatePage ? content.features : undefined}
            customHeading={isTemplatePage ? content.featuresHeading : undefined}
          />
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
