import { Box, Container, Heading, Text, VStack, Grid } from "@chakra-ui/react";
import { PricingCard } from "../PricingCard";
import { PricingToggle } from "../PricingToggle";
import { safeCapture } from "@/utils/safePosthog";
import { usePricingToggle } from "@/hooks/usePricingToggle";
import { getPriceUnit, BillingPeriod } from "@/utils/price";

interface V2PricingSectionProps {
  country?: string | null;
  billingPeriod?: BillingPeriod;
  setBillingPeriod?: (billingPeriod: BillingPeriod) => void;
  showGradient?: boolean;
}

export const PricingSection = ({
  country,
  billingPeriod: externalBillingPeriod,
  setBillingPeriod: externalSetBillingPeriod,
  showGradient = false,
}: V2PricingSectionProps) => {
  const internal = usePricingToggle({
    country,
    initialBillingPeriod: BillingPeriod.Yearly,
  });

  const billingPeriod = externalBillingPeriod ?? internal.billingPeriod;
  const setBillingPeriod = externalSetBillingPeriod ?? internal.setBillingPeriod;
  const { essentialInfo, professionalInfo, eliteInfo, premiumInfo } = internal;

  const isAnnual = billingPeriod === BillingPeriod.Yearly;
  const priceUnit = getPriceUnit(country);

  return (
    <Box
      as="section"
      id="pricing"
      py={{ base: 16, md: 24 }}
      position="relative"
      bgGradient={showGradient ? "linear(to-b, blue.100, blue.50)" : undefined}
      bg={showGradient ? undefined : "blue.50"}
      onMouseEnter={() => {
        safeCapture("new_landing_page_section_seen", {
          section: "pricing",
          variant: "v2",
        });
      }}
      _after={
        showGradient
          ? {
              content: '""',
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.05'/%3E%3C/svg%3E\")",
              opacity: 0.5,
              pointerEvents: "none",
            }
          : undefined
      }
    >
      <Container maxW="7xl" position="relative" zIndex={1}>
        <VStack spacing={{ base: 8, md: 12 }}>
          <VStack spacing={4} textAlign="center">
            <Heading
              as="h2"
              fontSize={{ base: "3xl", md: "5xl" }}
              fontWeight="normal"
              fontFamily="Georgia, serif"
              color="gray.800"
            >
              Simple, Transparent Pricing
            </Heading>
            <Text fontSize={{ base: "lg", md: "xl" }} color="gray.600" maxW="2xl">
              Choose the plan that works for you. Try our service and <br />
              <Text as="span" fontStyle="italic" fontWeight="semibold">
                you&apos;ll wish you started sooner.
              </Text>
            </Text>
          </VStack>

          <PricingToggle
            isAnnual={isAnnual}
            onToggle={(annual) =>
              setBillingPeriod(annual ? BillingPeriod.Yearly : BillingPeriod.Monthly)
            }
          />

          <Box w="full" maxW="7xl" mx="auto">
            <Grid
              templateColumns={{ base: "1fr", md: "repeat(2, 1fr)", xl: "repeat(4, 1fr)" }}
              gap={6}
              alignItems="stretch"
            >
              <PricingCard
                title="Essential"
                subtitle="Perfect for getting started"
                price={essentialInfo.price}
                priceUnit={priceUnit}
                features={essentialInfo.features}
                tokens={400}
                isAnnual={false}
                buttonLink="#intake-form"
              />
              <PricingCard
                title="Professional"
                subtitle="For regular users who need more capacity"
                price={professionalInfo.price}
                priceUnit={priceUnit}
                features={professionalInfo.features}
                tokens={1000}
                isAnnual={isAnnual}
                monthsFree={2}
                isPopular
                buttonLink="#intake-form"
              />
              <PricingCard
                title="Elite"
                subtitle="For heavy users and growing teams"
                price={eliteInfo.price}
                priceUnit={priceUnit}
                features={eliteInfo.features}
                tokens={1600}
                isAnnual={isAnnual}
                monthsFree={2}
                buttonLink="#intake-form"
              />
              <PricingCard
                title="Premium"
                subtitle="For high-volume enterprises needing maximum capacity"
                price={premiumInfo.price}
                priceUnit={priceUnit}
                features={premiumInfo.features}
                tokens={2300}
                isAnnual={isAnnual}
                monthsFree={3}
                buttonLink="#intake-form"
              />
            </Grid>
          </Box>
        </VStack>
      </Container>
    </Box>
  );
};
