import { useState } from "react";
import {
  getPrice,
  PaidSubscriptionPlan,
  BillingPeriod,
  getPlanForBillingPeriod,
} from "@/utils/price";
import {
  ESSENTIAL_FEATURES,
  PROFESSIONAL_FEATURES,
  PROFESSIONAL_ANNUAL_FEATURES,
  ELITE_FEATURES,
  ELITE_ANNUAL_FEATURES,
  PREMIUM_FEATURES,
  PREMIUM_ANNUAL_FEATURES,
} from "@/utils/planFeatures";

type PlanInfo = {
  plan: PaidSubscriptionPlan;
  price: number;
  priceId: string;
  features: string[];
};

type UsePricingToggleParams = {
  country?: string | null;
  initialBillingPeriod: BillingPeriod;
};

type UsePricingToggleReturn = {
  billingPeriod: BillingPeriod;
  setBillingPeriod: (billingPeriod: BillingPeriod) => void;
  essentialInfo: PlanInfo;
  professionalInfo: PlanInfo;
  eliteInfo: PlanInfo;
  premiumInfo: PlanInfo;
  /** @deprecated Use essentialInfo instead */
  basicInfo: PlanInfo;
  /** @deprecated Use professionalInfo instead */
  proInfo: PlanInfo;
};

export function usePricingToggle({
  country,
  initialBillingPeriod,
}: UsePricingToggleParams): UsePricingToggleReturn {
  const [billingPeriod, setBillingPeriod] = useState(initialBillingPeriod);

  // Essential only has a monthly plan in PayStack — always use monthly regardless of
  // the billing period toggle so the UI and checkout stay consistent.
  const essentialPlan: PaidSubscriptionPlan = "Essential";
  const professionalPlan: PaidSubscriptionPlan = getPlanForBillingPeriod(
    "Professional",
    billingPeriod
  );
  const elitePlan: PaidSubscriptionPlan = getPlanForBillingPeriod("Elite", billingPeriod);
  const premiumPlan: PaidSubscriptionPlan = getPlanForBillingPeriod("Premium", billingPeriod);

  const essentialInfo: PlanInfo = {
    plan: essentialPlan,
    price: getPrice(country, essentialPlan),
    priceId: "",
    features: ESSENTIAL_FEATURES,
  };

  const professionalInfo: PlanInfo = {
    plan: professionalPlan,
    price: getPrice(country, professionalPlan),
    priceId: "",
    features: billingPeriod === BillingPeriod.Yearly ? PROFESSIONAL_ANNUAL_FEATURES : PROFESSIONAL_FEATURES,
  };

  const eliteInfo: PlanInfo = {
    plan: elitePlan,
    price: getPrice(country, elitePlan),
    priceId: "",
    features: billingPeriod === BillingPeriod.Yearly ? ELITE_ANNUAL_FEATURES : ELITE_FEATURES,
  };

  const premiumInfo: PlanInfo = {
    plan: premiumPlan,
    price: getPrice(country, premiumPlan),
    priceId: "",
    features: billingPeriod === BillingPeriod.Yearly ? PREMIUM_ANNUAL_FEATURES : PREMIUM_FEATURES,
  };

  return {
    billingPeriod,
    setBillingPeriod,
    essentialInfo,
    professionalInfo,
    eliteInfo,
    premiumInfo,
    basicInfo: essentialInfo,
    proInfo: professionalInfo,
  };
}
