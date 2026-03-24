import { useMemo } from "react";
import {
  SubscriptionPlan,
  PaidSubscriptionPlan,
  BillingPeriod,
  UpgradeKind,
  getUpgradePlanName,
  getBasePlan,
  getPlanForBillingPeriod,
  isPlanProratable,
} from "@/utils/price";
import useSWR from "swr";
import useSWRMutation from "swr/mutation";

export interface UpgradePlanInfo {
  upgradeKind: UpgradeKind;
  targetSubscriptionPlan?: PaidSubscriptionPlan;
  nextPlan?: PaidSubscriptionPlan;
  proratedData?: any;
  upgradePlan: (targetPlan: PaidSubscriptionPlan) => Promise<any>;
}

export function useUpgradePlan(
  planName: SubscriptionPlan,
  billingPeriod: BillingPeriod,
  country?: string
): UpgradePlanInfo {
  const upgradeInfo = useMemo(() => {
    const nextPlan = getUpgradePlanName(planName);

    if (nextPlan === null) {
      return {
        upgradeKind: UpgradeKind.Custom,
        targetSubscriptionPlan: getPlanForBillingPeriod(getBasePlan(planName), billingPeriod),
        nextPlan: undefined,
      };
    }

    const targetPlan =
      planName === "Free"
        ? getPlanForBillingPeriod(getBasePlan(nextPlan), billingPeriod)
        : nextPlan;

    return {
      upgradeKind: UpgradeKind.Standard,
      targetSubscriptionPlan: targetPlan,
      nextPlan,
    };
  }, [planName, billingPeriod]);

  const { data: proratedData } = useSWR(
    country == null || !isPlanProratable(planName) || upgradeInfo.upgradeKind === UpgradeKind.Custom
      ? null
      : "/api/get-upgrade-prorated-cost",
    async (uri) => {
      return await fetch(uri, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          country,
          targetPlan: upgradeInfo.targetSubscriptionPlan,
        }),
      }).then((res) => res.json());
    }
  );

  const { trigger: upgradePlan } = useSWRMutation(
    "/api/upgrade-plan",
    async (url, { arg: targetPlan }: { arg: PaidSubscriptionPlan }) => {
      return await fetch("/api/upgrade-plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          country,
          targetPlan,
        }),
      }).then((res) => res.json());
    }
  );

  return {
    ...upgradeInfo,
    proratedData,
    upgradePlan,
  };
}
