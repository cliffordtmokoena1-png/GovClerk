import { useState, useEffect } from "react";
import { Box, VStack } from "@chakra-ui/react";
import { NavBar } from "@/components/landing/NavBar";
import { PricingHeroSection } from "@/components/landing/sections/PricingHeroSection";
import { CompanyCarousel } from "@/components/landing/sections/CompanyCarousel";
import { TestimonialsSection } from "@/components/landing/GovClerk/GovClerkTestimonialsSection";
import { PricingComparisonTable } from "@/components/landing/PricingComparisonTable";
import { FaqSection } from "@/components/landing/GovClerk/GovClerkFaqSection";
import { CtaSection } from "@/components/landing/GovClerk/GovClerkCtaSection";
import { Footer } from "@/components/landing/Footer";
import { GradientBackground } from "@/components/GradientBackground";
import MgHead from "@/components/MgHead";
import { getPersonalizationFromCookies } from "@/utils/landing/landingUtils";
import { usePricingToggle } from "@/hooks/usePricingToggle";
import { BillingPeriod, getPriceUnit } from "@/utils/price";

export default function PricingPage() {
  const [country, setCountry] = useState<string | null>(null);

  useEffect(() => {
    const { country } = getPersonalizationFromCookies();
    setCountry(country);
  }, []);

  const { billingPeriod, essentialInfo, professionalInfo } = usePricingToggle({
    country,
    initialBillingPeriod: BillingPeriod.Yearly,
  });

  const isAnnual = billingPeriod === BillingPeriod.Yearly;
  const priceUnit = getPriceUnit(country);

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
            <PricingHeroSection country={country} />
            <CompanyCarousel />
            <TestimonialsSection />
            <PricingComparisonTable
              basicPrice={essentialInfo.price}
              proPrice={professionalInfo.price}
              priceUnit={priceUnit}
              isAnnual={isAnnual}
            />
            <FaqSection />
            <CtaSection />
          </VStack>

          <Footer />
        </Box>
      </Box>
    </>
  );
}
