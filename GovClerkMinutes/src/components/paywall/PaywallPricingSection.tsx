import { Box, Text, HStack, useBreakpointValue } from "@chakra-ui/react";
import PaywallPricingCard from "./PaywallPricingCard";
import PricingToggle from "@/components/shared/PricingToggle";
import {
  getPriceUnit,
  getUpgradePlanName,
  isPlanBasic,
  isPlanPro,
  PaidSubscriptionPlan,
  SubscriptionPlan,
  getPrice,
  getBasePlan,
  BillingPeriod,
  getPlanForBillingPeriod,
} from "@/utils/price";

type Props = {
  currentPlan: SubscriptionPlan;
  requiredToken: number;
  country: string;
  billingPeriod: BillingPeriod;
  onToggleBillingPeriod: (billingPeriod: BillingPeriod) => void;
  showBillingToggle?: boolean;
};

type Plan = {
  plan: SubscriptionPlan | "Custom";
  price: number;
  priceUnit: string;
  tokens: number;
  features: Array<{
    text: string;
    included: boolean;
  }>;
};

export default function PaywallPricingSection({
  currentPlan,
  requiredToken,
  country,
  billingPeriod,
  onToggleBillingPeriod,
  showBillingToggle = true,
}: Props) {
  const pricingBillingPeriod =
    currentPlan === "Free"
      ? billingPeriod
      : currentPlan.includes("Annual")
        ? BillingPeriod.Yearly
        : BillingPeriod.Monthly;

  const priceUnit = getPriceUnit(country);

  const plans: Plan[] = [
    {
      plan: "Free",
      price: 0,
      priceUnit,
      tokens: 0,
      features: [
        { text: "Minutes and transcripts for 30 minutes of meetings (30 tokens)", included: true },
        { text: "Basic support", included: false },
        { text: "Save minutes to Microsoft Word", included: false },
      ],
    },
    {
      plan: "Basic",
      price: getPrice(country, getPlanForBillingPeriod("Basic", pricingBillingPeriod)),
      priceUnit,
      tokens: 300,
      features: [
        { text: "Minutes and transcripts for 5 hours of meetings (300 tokens)", included: true },
        { text: "Basic support", included: true },
        { text: "Save minutes to Microsoft Word", included: true },
        { text: "14 day money back guarantee", included: true },
      ],
    },
    {
      plan: "Pro",
      price: getPrice(country, getPlanForBillingPeriod("Pro", pricingBillingPeriod)),
      priceUnit,
      tokens: 1200,
      features: [
        { text: "Minutes and transcripts for 20 hours of meetings (1200 tokens)", included: true },
        { text: "Priority support", included: true },
        { text: "Save minutes to Microsoft Word", included: true },
        { text: "14 day money back guarantee", included: true },
      ],
    },
    {
      plan: "Custom",
      price: -1, // Special value to indicate "Price upon request"
      priceUnit,
      tokens: -1, // Special value to hide tokens display
      features: [
        { text: "Custom minutes and transcripts volume", included: true },
        { text: "Save minutes to Microsoft Word", included: true },
        { text: "Priority support over email and chat", included: true },
      ],
    },
  ];

  // Determine which plan to recommend based on required tokens
  let recommendedBasePlan: string;
  if (isPlanPro(currentPlan)) {
    recommendedBasePlan = "Custom";
  } else if (isPlanBasic(currentPlan)) {
    recommendedBasePlan = "Pro";
  } else if (requiredToken > 300) {
    recommendedBasePlan = "Pro";
  } else {
    recommendedBasePlan = "Basic";
  }

  // Show current plan + recommended plan
  const currentBasePlan = getBasePlan(currentPlan);

  const visiblePlans = plans.filter((plan) => {
    if (currentPlan === "Free") {
      return plan.plan === "Free" || plan.plan === recommendedBasePlan;
    }
    return plan.plan === currentBasePlan || plan.plan === recommendedBasePlan;
  });

  const isMobile = useBreakpointValue({ base: true, md: false });
  const plansToShow = isMobile
    ? visiblePlans.filter((plan) => plan.plan === recommendedBasePlan)
    : visiblePlans;

  return (
    <Box w="full">
      {showBillingToggle && (
        <PricingToggle
          isAnnual={billingPeriod === BillingPeriod.Yearly}
          onToggle={(isAnnual) =>
            onToggleBillingPeriod(isAnnual ? BillingPeriod.Yearly : BillingPeriod.Monthly)
          }
          className="mb-6"
        />
      )}

      <HStack spacing={6} align="stretch" w="full">
        {plansToShow.map((plan) => {
          const isCurrentPlan = getBasePlan(currentPlan) === plan.plan;
          const isRecommendedPlan = plan.plan === recommendedBasePlan;

          return (
            <Box
              key={plan.plan}
              bg={isRecommendedPlan ? "blue.50" : "white"}
              borderColor={isRecommendedPlan ? "blue.500" : "gray.500"}
              borderRadius="lg"
              borderWidth="1px"
              flex="1"
              overflow="hidden"
            >
              <Box>
                <Box bg={isRecommendedPlan ? "blue.500" : "gray.500"} py={2} px={4}>
                  <Text color="white" fontWeight="semibold" textAlign="center">
                    {isCurrentPlan ? "Current Plan" : "Recommended Plan"}
                  </Text>
                </Box>
                <PaywallPricingCard
                  {...plan}
                  isRecommended={plan.plan === recommendedBasePlan}
                  isAnnual={pricingBillingPeriod === BillingPeriod.Yearly}
                  country={country}
                  showBillingToggle={showBillingToggle}
                  onToggleBilling={() =>
                    onToggleBillingPeriod(
                      billingPeriod === BillingPeriod.Yearly
                        ? BillingPeriod.Monthly
                        : BillingPeriod.Yearly
                    )
                  }
                />
              </Box>
            </Box>
          );
        })}
      </HStack>
    </Box>
  );
}
