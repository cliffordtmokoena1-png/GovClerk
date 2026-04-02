import { Box, Grid } from "@chakra-ui/react";
import { ApiGetCustomerDetailsResponse } from "@/pages/api/get-customer-details";
import { getPriceUnit, BillingPeriod } from "@/utils/price";
import PricingCard from "./PricingCard";
import PricingToggle from "@/components/shared/PricingToggle";
import { useUser } from "@clerk/nextjs";
import { getClientReferenceId } from "@/utils/getClientReferenceId";
import { usePricingToggle } from "@/hooks/usePricingToggle";
import { CUSTOM_FEATURES } from "@/utils/planFeatures";

interface Props {
  country: string | null | undefined;
  transcriptId?: number;
  customerDetails?: ApiGetCustomerDetailsResponse | null;
}

export default function PricingTable({ country, transcriptId, customerDetails }: Props) {
  const { user } = useUser();
  const {
    billingPeriod,
    setBillingPeriod,
    essentialInfo,
    professionalInfo,
    eliteInfo,
    premiumInfo,
  } = usePricingToggle({
    country,
    initialBillingPeriod: BillingPeriod.Yearly,
  });

  const isAnnual = billingPeriod === BillingPeriod.Yearly;
  const toggleBilling = () =>
    setBillingPeriod(isAnnual ? BillingPeriod.Monthly : BillingPeriod.Yearly);

  const priceUnit = getPriceUnit(country);

  return (
    <Box py={12}>
      <PricingToggle
        isAnnual={isAnnual}
        onToggle={(annual) =>
          setBillingPeriod(annual ? BillingPeriod.Yearly : BillingPeriod.Monthly)
        }
        className="mb-8"
      />

      <Grid
        templateColumns={{ base: "1fr", md: "repeat(2, 1fr)", xl: "repeat(4, 1fr)" }}
        gap={6}
        maxW="7xl"
        mx="auto"
      >
        <PricingCard
          title="Essential"
          subtitle="Perfect for getting started"
          price={essentialInfo.price}
          priceUnit={priceUnit}
          features={essentialInfo.features}
          clientReferenceId={getClientReferenceId(transcriptId, user?.id)}
          priceId=""
          tokens={400}
          isAnnual={isAnnual}
          country={country ?? "ZA"}
          onToggleBilling={toggleBilling}
        />
        <PricingCard
          title="Professional"
          subtitle="For regular users who need more capacity"
          price={professionalInfo.price}
          priceUnit={priceUnit}
          features={professionalInfo.features}
          clientReferenceId={getClientReferenceId(transcriptId, user?.id)}
          priceId=""
          isPopular
          tokens={1000}
          isAnnual={isAnnual}
          country={country ?? "ZA"}
          onToggleBilling={toggleBilling}
        />
        <PricingCard
          title="Elite"
          subtitle="For heavy users and growing teams"
          price={eliteInfo.price}
          priceUnit={priceUnit}
          features={eliteInfo.features}
          clientReferenceId={getClientReferenceId(transcriptId, user?.id)}
          priceId=""
          tokens={1600}
          isAnnual={isAnnual}
          country={country ?? "ZA"}
          onToggleBilling={toggleBilling}
        />
        <PricingCard
          title="Premium"
          subtitle="For high-volume enterprises needing maximum capacity"
          price={premiumInfo.price}
          priceUnit={priceUnit}
          features={premiumInfo.features}
          clientReferenceId={getClientReferenceId(transcriptId, user?.id)}
          priceId=""
          tokens={2300}
          isAnnual={isAnnual}
          country={country ?? "ZA"}
          onToggleBilling={toggleBilling}
        />
      </Grid>
    </Box>
  );
}
