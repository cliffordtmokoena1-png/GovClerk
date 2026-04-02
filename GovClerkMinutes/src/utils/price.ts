import { isDev } from "./dev";

export enum BillingPeriod {
  Monthly,
  Yearly,
}

export enum UpgradeKind {
  Standard,
  Custom,
}

export type CountryCode = "ZA" | "IN" | "PH" | "Default";
export type PayAsYouGoPlan = "Basic" | "Pro";
export type CreditPack = 60 | 120 | 180 | 240;
export type SubscriptionPlan =
  | "Free"
  // New PayStack tiers
  | "Essential"
  | "Professional"
  | "Elite"
  | "Premium"
  | "Essential_Annual"
  | "Professional_Annual"
  | "Elite_Annual"
  | "Premium_Annual"
  // Legacy plans kept for backward compatibility with existing subscriptions
  | "Basic"
  | "Pro"
  | "Basic_Annual"
  | "Pro_Annual";
export type PaidSubscriptionPlan = Exclude<SubscriptionPlan, "Free">;
export type BaseSubscriptionPlan =
  | "Essential"
  | "Professional"
  | "Elite"
  | "Premium"
  | "Basic"
  | "Pro"
  | "Free";
export type AnnualSubscriptionPlan = Extract<
  SubscriptionPlan,
  | "Essential_Annual"
  | "Professional_Annual"
  | "Elite_Annual"
  | "Premium_Annual"
  | "Basic_Annual"
  | "Pro_Annual"
>;
export type Env = "dev" | "prod";

// Only legacy Stripe-based subscription plans have price IDs.
// New PayStack tiers (Essential, Professional, Elite, Premium) use PayStack
// plan codes from environment variables — they do NOT need entries here.
export type LegacySubscriptionPlan = "Basic" | "Pro" | "Basic_Annual" | "Pro_Annual";
type LegacySubscriptionPlanIds = Record<LegacySubscriptionPlan, string>;

export const PRICE_IDS: {
  [env in Env]: {
    PayAsYouGo: {
      [country in CountryCode]: {
        [plan in PayAsYouGoPlan]: { [pack in CreditPack]: string };
      };
    };
    Subscription: {
      [country in CountryCode]: LegacySubscriptionPlanIds;
    };
  };
} = {
  dev: {
    PayAsYouGo: {
      PH: {
        Basic: {
          240: "price_1RsYfQIV9fK89cLXSiiT3Kak",
          180: "price_1RsYdhIV9fK89cLXzyOnwww5",
          120: "price_1RsYbcIV9fK89cLXNxlAoUGz",
          60: "price_1RsYXYIV9fK89cLXRpByKPC9",
        },
        Pro: {
          240: "price_1RsYn6IV9fK89cLXopcFwbrI",
          180: "price_1RsYlOIV9fK89cLXSVeaV4J9",
          120: "price_1RsYjWIV9fK89cLX43TWZXt5",
          60: "price_1RsYhuIV9fK89cLXtgnL4AgC",
        },
      },
      ZA: {
        Basic: {
          240: "price_1RsYfQIV9fK89cLXjqxntITb",
          180: "price_1RsYdhIV9fK89cLXwVVrYqW8",
          120: "price_1RsYbcIV9fK89cLX8b9XSBek",
          60: "price_1RsYXYIV9fK89cLXiGwoHNFc",
        },
        Pro: {
          240: "price_1RsYn6IV9fK89cLXcKEy8bN7",
          180: "price_1RsYlOIV9fK89cLXV0XqtGGT",
          120: "price_1RsYjWIV9fK89cLXeh6TxEK9",
          60: "price_1RsYhuIV9fK89cLXnwzOjwwS",
        },
      },
      IN: {
        Basic: {
          240: "price_1RsYfQIV9fK89cLXzkdpfFJW",
          180: "price_1RsYdhIV9fK89cLXOnBBMIay",
          120: "price_1RsYbcIV9fK89cLXESl1S0pn",
          60: "price_1RsYXYIV9fK89cLXAEFYcf6a",
        },
        Pro: {
          240: "price_1RsYn6IV9fK89cLXpN5of4LI",
          180: "price_1RsYlOIV9fK89cLXTmqrCmC7",
          120: "price_1RsYjWIV9fK89cLXXyhMAmpS",
          60: "price_1RsYhuIV9fK89cLXnTOwQV9B",
        },
      },
      Default: {
        Basic: {
          240: "price_1RsYeCIV9fK89cLXFq1dLTYY",
          180: "price_1RsYcKIV9fK89cLXXbk2SeLh",
          120: "price_1RsYa0IV9fK89cLXfIy6ZahX",
          60: "price_1RsYV1IV9fK89cLXg7rx39Nx",
        },
        Pro: {
          240: "price_1RsYm2IV9fK89cLXAazDgvYS",
          180: "price_1RsYkHIV9fK89cLXm2mNfEJM",
          120: "price_1RsYiTIV9fK89cLXYkmfW9mG",
          60: "price_1RsYgDIV9fK89cLXG3UJA1vZ",
        },
      },
    },
    Subscription: {
      ZA: {
        Basic: "price_1PeT5xIV9fK89cLXsIkvVtUs",
        Pro: "price_1PeT5wIV9fK89cLXr1DvdZwq",
        Basic_Annual: "price_1RYs8xIV9fK89cLXkZHBE7k6",
        Pro_Annual: "price_1RYs8yIV9fK89cLXibEEAhvE",
      },
      IN: {
        Basic: "price_1PeT5wIV9fK89cLXDCvEkqJB",
        Pro: "price_1PeT5vIV9fK89cLXKcpgxPVp",
        Basic_Annual: "price_1RYs8yIV9fK89cLXfuk889lW",
        Pro_Annual: "price_1RYs8zIV9fK89cLXy4gZnt0q",
      },
      PH: {
        Basic: "price_1PeT5vIV9fK89cLXyShoK1pq",
        Pro: "price_1PeT5uIV9fK89cLXm48i6qcK",
        Basic_Annual: "price_1RYs8zIV9fK89cLXDrXu4ZsN",
        Pro_Annual: "price_1RYs90IV9fK89cLX7y3oXGw4",
      },
      Default: {
        Basic: "price_1PeT5tIV9fK89cLXMwuS9Ptk",
        Pro: "price_1PeT5sIV9fK89cLXx12D2UeF",
        Basic_Annual: "price_1RYs90IV9fK89cLXaZYjHSjc",
        Pro_Annual: "price_1RYs91IV9fK89cLX0yQ6KjrW",
      },
    },
  },
  prod: {
    PayAsYouGo: {
      ZA: {
        Basic: {
          240: "price_1RxvokIV9fK89cLX7kO08vFW",
          180: "price_1RxvomIV9fK89cLXLLxd0vun",
          120: "price_1RxvopIV9fK89cLX3UBntp1z",
          60: "price_1RxvoqIV9fK89cLXwBRQMf2A",
        },
        Pro: {
          240: "price_1RxvedIV9fK89cLXtmf7RCGZ",
          180: "price_1RxvofIV9fK89cLX3XMFYK7l",
          120: "price_1RxvohIV9fK89cLX4WdJnOwO",
          60: "price_1RxvojIV9fK89cLXtR3f3uPw",
        },
      },
      IN: {
        Basic: {
          240: "price_1RxvolIV9fK89cLXXhQJQuNy",
          180: "price_1RxvomIV9fK89cLXWEureFqE",
          120: "price_1RxvopIV9fK89cLXVabTQW0Q",
          60: "price_1RxvoqIV9fK89cLXVRv95Zgg",
        },
        Pro: {
          240: "price_1RxvedIV9fK89cLXVYkwK3RE",
          180: "price_1RxvofIV9fK89cLXITfk4iob",
          120: "price_1RxvohIV9fK89cLXHn7vyOXR",
          60: "price_1RxvojIV9fK89cLX0vSRtSpv",
        },
      },
      PH: {
        Basic: {
          240: "price_1RxvokIV9fK89cLXl85VV28S",
          180: "price_1RxvomIV9fK89cLXwygeET7b",
          120: "price_1RxvopIV9fK89cLXTa4s0P8I",
          60: "price_1RxvoqIV9fK89cLXU6XElHLK",
        },
        Pro: {
          240: "price_1RxvecIV9fK89cLXek1QOqkF",
          180: "price_1RxvofIV9fK89cLXjClw8nVT",
          120: "price_1RxvohIV9fK89cLXMEFes8JK",
          60: "price_1RxvojIV9fK89cLXxJoxfXYd",
        },
      },
      Default: {
        Basic: {
          240: "price_1RxvolIV9fK89cLX4QTk4e0R",
          180: "price_1RxvomIV9fK89cLXPsa2KIOC",
          120: "price_1RxvopIV9fK89cLX7KJFfu73",
          60: "price_1RxvoqIV9fK89cLXNR4sFAdn",
        },
        Pro: {
          240: "price_1RxvedIV9fK89cLXrg9gOhrM",
          180: "price_1RxvofIV9fK89cLXjClw8nVT",
          120: "price_1RxvohIV9fK89cLXu6YZDPTN",
          60: "price_1RxvojIV9fK89cLX5Ljyyy3g",
        },
      },
    },
    Subscription: {
      ZA: {
        Basic: "price_1PeT9zIV9fK89cLX6frKBpN1",
        Pro: "price_1PeT9yIV9fK89cLX6XyLMHZb",
        Basic_Annual: "price_1RYtrgIV9fK89cLXzTtB1dEl",
        Pro_Annual: "price_1RYtrgIV9fK89cLX8mZCA4JR",
      },
      IN: {
        Basic: "price_1PeT9xIV9fK89cLXTN9vPrPx",
        Pro: "price_1PeT9xIV9fK89cLXrYsNXYbH",
        Basic_Annual: "price_1RYtrhIV9fK89cLX4Li8CN4k",
        Pro_Annual: "price_1RYtrhIV9fK89cLXc1uiuIgS",
      },
      PH: {
        Basic: "price_1PeT9uIV9fK89cLXV7UCL9wQ",
        Pro: "price_1PeT9wIV9fK89cLXF2I5VbEb",
        Basic_Annual: "price_1RYtriIV9fK89cLXwgSMogEV",
        Pro_Annual: "price_1RYtriIV9fK89cLXKzOktgSC",
      },
      Default: {
        Basic: "price_1PeT9uIV9fK89cLXUERsu22d",
        Pro: "price_1PeT9tIV9fK89cLXVPNvi5WL",
        Basic_Annual: "price_1RYtrjIV9fK89cLXJFjxcxzp",
        Pro_Annual: "price_1RYtrjIV9fK89cLXWl7aeyP1",
      },
    },
  },
};

export function isPaidSubscriptionPlan(plan: unknown): plan is PaidSubscriptionPlan {
  return (
    typeof plan === "string" &&
    (plan === "Essential" ||
      plan === "Professional" ||
      plan === "Elite" ||
      plan === "Premium" ||
      plan === "Essential_Annual" ||
      plan === "Professional_Annual" ||
      plan === "Elite_Annual" ||
      plan === "Premium_Annual" ||
      plan === "Basic" ||
      plan === "Pro" ||
      plan === "Basic_Annual" ||
      plan === "Pro_Annual")
  );
}

// Old basic price ID corresponding to $27/month
const OLD_BASIC_PRICE_ID = "price_1PeTA0IV9fK89cLXmNDtg8ae";

export function getPriceUnit(country: string | null | undefined): string {
  switch (country) {
    case "ZA":
      return "ZAR ";
    case "IN":
      return "₹";
    case "PH":
      return "₱";
    case "US":
      return "$";
    default:
      return "$";
  }
}

export function getPrice(country: string | null | undefined, plan: SubscriptionPlan): number {
  if (plan === "Free") {
    return 0;
  }

  // New PayStack tiers — ZAR-denominated plans, used for all countries
  switch (plan) {
    case "Essential":
      return 300;
    case "Professional":
      return 450;
    case "Elite":
      return 600;
    case "Premium":
      return 900;
    case "Essential_Annual":
      return 3000;
    case "Professional_Annual":
      return 4500;
    case "Elite_Annual":
      return 6000;
    case "Premium_Annual":
      return 8100;
  }

  switch (country) {
    case "ZA": {
      switch (plan) {
        case "Basic":
          return 275;
        case "Pro":
          return 475;
        case "Basic_Annual":
          return 2750;
        case "Pro_Annual":
          return 4750;
      }
    }
    case "IN": {
      switch (plan) {
        case "Basic":
          return 1250;
        case "Pro":
          return 2075;
        case "Basic_Annual":
          return 12500;
        case "Pro_Annual":
          return 20750;
      }
    }
    case "PH": {
      switch (plan) {
        case "Basic":
          return 875;
        case "Pro":
          return 1475;
        case "Basic_Annual":
          return 8750;
        case "Pro_Annual":
          return 14750;
      }
    }
    case "US": {
      switch (plan) {
        case "Basic":
          return 15;
        case "Pro":
          return 25;
        case "Basic_Annual":
          return 150;
        case "Pro_Annual":
          return 250;
      }
    }
    default: {
      switch (plan) {
        case "Basic":
          return 15;
        case "Pro":
          return 25;
        case "Basic_Annual":
          return 150;
        case "Pro_Annual":
          return 250;
      }
    }
  }
}

function getCountryCode(country: string | null | undefined): CountryCode {
  if (country === "ZA" || country === "IN" || country === "PH") {
    return country;
  } else {
    return "Default";
  }
}

export function getPayAsYouGoPriceId(
  country: string,
  plan: PayAsYouGoPlan,
  tokens: CreditPack
): string {
  const env: Env = isDev() ? "dev" : "prod";
  const countryCode: CountryCode = getCountryCode(country);
  return PRICE_IDS[env].PayAsYouGo[countryCode][plan][tokens];
}

export function getPayAsYouGoPackPrice(
  country: string | null | undefined,
  plan: PayAsYouGoPlan,
  tokens: CreditPack
): number {
  const c = country ?? "US";
  const pack = tokens as CreditPack;
  if (plan === "Basic") {
    switch (c) {
      case "PH": {
        switch (pack) {
          case 60:
            return 525;
          case 120:
            return 925;
          case 180:
            return 1225;
          case 240:
            return 1450;
        }
      }
      case "ZA": {
        switch (pack) {
          case 60:
            return 175;
          case 120:
            return 300;
          case 180:
            return 375;
          case 240:
            return 450;
        }
      }
      case "IN": {
        switch (pack) {
          case 60:
            return 750;
          case 120:
            return 1325;
          case 180:
            return 1750;
          case 240:
            return 2050;
        }
      }
      default: {
        // USD
        switch (pack) {
          case 60:
            return 9;
          case 120:
            return 16;
          case 180:
            return 21;
          case 240:
            return 24;
        }
      }
    }
  } else {
    // Pro
    switch (c) {
      case "PH": {
        switch (pack) {
          case 60:
            return 425;
          case 120:
            return 775;
          case 180:
            return 1000;
          case 240:
            return 1175;
        }
      }
      case "ZA": {
        switch (pack) {
          case 60:
            return 125;
          case 120:
            return 250;
          case 180:
            return 325;
          case 240:
            return 375;
        }
      }
      case "IN": {
        switch (pack) {
          case 60:
            return 575;
          case 120:
            return 1075;
          case 180:
            return 1400;
          case 240:
            return 1650;
        }
      }
      default: {
        switch (pack) {
          case 60:
            return 7;
          case 120:
            return 13;
          case 180:
            return 17;
          case 240:
            return 20;
        }
      }
    }
  }
  return 0;
}

export function getPriceId(
  country: string | null | undefined,
  plan: LegacySubscriptionPlan
): string {
  const env: Env = isDev() ? "dev" : "prod";
  const countryCode: CountryCode = getCountryCode(country);
  return PRICE_IDS[env].Subscription[countryCode][plan];
}

export function getPlanFromPriceId(priceId: string): PaidSubscriptionPlan | null {
  const env: Env = isDev() ? "dev" : "prod";
  const countries = Object.keys(PRICE_IDS[env].Subscription) as CountryCode[];
  for (const country of countries) {
    const plans = Object.keys(PRICE_IDS[env].Subscription[country]) as LegacySubscriptionPlan[];
    for (const plan of plans) {
      const id = PRICE_IDS[env].Subscription[country][plan];
      if (id === priceId) {
        return plan;
      }
    }
  }
  return null;
}

export function getCountryFromPriceId(priceId: string): string | null {
  const env: Env = isDev() ? "dev" : "prod";
  const countries = Object.keys(PRICE_IDS[env].Subscription) as CountryCode[];
  for (const country of countries) {
    const plans = Object.keys(PRICE_IDS[env].Subscription[country]) as LegacySubscriptionPlan[];
    for (const plan of plans) {
      const id = PRICE_IDS[env].Subscription[country][plan];
      if (id === priceId) {
        return country;
      }
    }
  }
  return null;
}

export function isPriceIdAnnual(priceId: string): boolean {
  const env: Env = isDev() ? "dev" : "prod";
  const countries = Object.keys(PRICE_IDS[env].Subscription) as CountryCode[];
  for (const country of countries) {
    const plans = Object.keys(PRICE_IDS[env].Subscription[country]) as LegacySubscriptionPlan[];
    for (const plan of plans) {
      const id = PRICE_IDS[env].Subscription[country][plan];
      if (id === priceId) {
        return plan.endsWith("_Annual");
      }
    }
  }
  return false;
}

export function isPayAsYouGoPriceId(priceId: string): boolean {
  const env: Env = isDev() ? "dev" : "prod";
  const countries = Object.keys(PRICE_IDS[env].PayAsYouGo) as CountryCode[];
  for (const country of countries) {
    const plans = Object.keys(PRICE_IDS[env].PayAsYouGo[country]) as PayAsYouGoPlan[];
    for (const plan of plans) {
      const packs = PRICE_IDS[env].PayAsYouGo[country][plan];
      for (const tokens of [60, 120, 180, 240] as CreditPack[]) {
        if (packs[tokens] === priceId) {
          return true;
        }
      }
    }
  }
  return false;
}

// Used to get the price id for the "Pro" plan when upgrading from a "Basic"
// plan.  Linear search through price ids to find the upgraded price id.  If one
// doesn't exist because the price id for a "Pro" plan was passed, we return
// null.
// This is for subscriptions only.
export function getUpgradePriceId(basePriceId: string): string | null {
  const env: Env = isDev() ? "dev" : "prod";
  const countries = Object.keys(PRICE_IDS[env].Subscription) as CountryCode[];

  for (const country of countries) {
    const subscriptionPrices = PRICE_IDS[env].Subscription[country];

    if (subscriptionPrices.Basic === basePriceId) {
      return subscriptionPrices.Pro;
    }

    if (subscriptionPrices.Basic_Annual === basePriceId) {
      return subscriptionPrices.Pro_Annual;
    }

    if (subscriptionPrices.Pro === basePriceId || subscriptionPrices.Pro_Annual === basePriceId) {
      console.error("Cannot upgrade from Pro plan");
      return null;
    }
  }

  if (basePriceId === OLD_BASIC_PRICE_ID) {
    return PRICE_IDS[env].Subscription.Default.Pro;
  }

  console.error("Cannot upgrade from id", basePriceId);
  return null;
}

export function getUpgradePlanName(basePlan: SubscriptionPlan): PaidSubscriptionPlan | null {
  switch (basePlan) {
    case "Free":
      return "Essential";
    case "Essential":
      return "Professional";
    case "Essential_Annual":
      return "Professional_Annual";
    case "Professional":
      return "Elite";
    case "Professional_Annual":
      return "Elite_Annual";
    case "Elite":
      return "Premium";
    case "Elite_Annual":
      return "Premium_Annual";
    case "Premium":
      return null;
    case "Premium_Annual":
      return null;
    // Legacy plan upgrades
    case "Basic":
      return "Pro";
    case "Basic_Annual":
      return "Pro_Annual";
    case "Pro":
      return null;
    case "Pro_Annual":
      return null;
    default:
      console.warn(`[getUpgradePlanName] Unrecognized plan: ${basePlan}`);
      return null;
  }
}

/// Checks if a plan can have a prorated cost calculated.
/// For example, upgrading from "Basic" to "Pro" or from "Essential" to a higher
/// tier can be prorated, but upgrading from "Free" cannot.
export function isPlanProratable(plan: SubscriptionPlan): boolean {
  return (
    plan === "Essential" ||
    plan === "Essential_Annual" ||
    plan === "Professional" ||
    plan === "Professional_Annual" ||
    plan === "Elite" ||
    plan === "Elite_Annual" ||
    plan === "Basic" ||
    plan === "Basic_Annual"
  );
}

export function isPlanBasic(plan: SubscriptionPlan): boolean {
  return plan === "Basic" || plan === "Basic_Annual";
}

export function isPlanPro(plan: SubscriptionPlan): boolean {
  return plan === "Pro" || plan === "Pro_Annual";
}

export function getPrettyPlanName(plan: SubscriptionPlan | undefined): string {
  switch (plan) {
    case "Free":
      return "Trial";
    case "Essential":
    case "Essential_Annual":
      return "Essential";
    case "Professional":
    case "Professional_Annual":
      return "Professional";
    case "Elite":
    case "Elite_Annual":
      return "Elite";
    case "Premium":
    case "Premium_Annual":
      return "Premium";
    case "Basic":
    case "Basic_Annual":
      return "Basic";
    case "Pro":
    case "Pro_Annual":
      return "Pro";
    default:
      return "";
  }
}

export function getPlanForBillingPeriod(
  basePlan: BaseSubscriptionPlan,
  billingPeriod: BillingPeriod
): PaidSubscriptionPlan {
  const isAnnual = billingPeriod === BillingPeriod.Yearly;
  switch (basePlan) {
    case "Essential":
      return isAnnual ? "Essential_Annual" : "Essential";
    case "Professional":
      return isAnnual ? "Professional_Annual" : "Professional";
    case "Elite":
      return isAnnual ? "Elite_Annual" : "Elite";
    case "Premium":
      return isAnnual ? "Premium_Annual" : "Premium";
    case "Basic":
      return isAnnual ? "Basic_Annual" : "Basic";
    default:
      return isAnnual ? "Pro_Annual" : "Pro";
  }
}

export function getBasePlan(plan: SubscriptionPlan): BaseSubscriptionPlan {
  switch (plan) {
    case "Essential":
    case "Essential_Annual":
      return "Essential";
    case "Professional":
    case "Professional_Annual":
      return "Professional";
    case "Elite":
    case "Elite_Annual":
      return "Elite";
    case "Premium":
    case "Premium_Annual":
      return "Premium";
    case "Basic":
    case "Basic_Annual":
      return "Basic";
    case "Pro":
    case "Pro_Annual":
      return "Pro";
    default:
      return "Free";
  }
}

export function getBillingPeriod(plan: SubscriptionPlan): BillingPeriod {
  if (plan === "Free") {
    return BillingPeriod.Yearly; // Default to annual for free users
  }
  return isPlanAnnual(plan) ? BillingPeriod.Yearly : BillingPeriod.Monthly;
}

export function isPlanAnnual(plan: SubscriptionPlan): plan is AnnualSubscriptionPlan {
  return (
    plan === "Essential_Annual" ||
    plan === "Professional_Annual" ||
    plan === "Elite_Annual" ||
    plan === "Premium_Annual" ||
    plan === "Basic_Annual" ||
    plan === "Pro_Annual"
  );
}

export function getEffectiveMonthlyPrice(
  country: string | null | undefined,
  plan: AnnualSubscriptionPlan
): number {
  const annualPrice = getPrice(country, plan);
  return Math.round((annualPrice / 12) * 100) / 100; // Round to 2 decimal places
}

export function formatPrice(amount: number): string {
  if (!Number.isFinite(amount)) {
    return "0";
  }

  const rounded = Math.round((amount + Number.EPSILON) * 100) / 100;
  return rounded % 1 === 0 ? String(rounded) : rounded.toFixed(2);
}

export type GetAnnualSavingsParams =
  | {
      monthlyPlan: "Basic";
      yearlyPlan: "Basic_Annual";
    }
  | {
      monthlyPlan: "Pro";
      yearlyPlan: "Pro_Annual";
    };

export function getAnnualSavings(
  country: string | null | undefined,
  { monthlyPlan, yearlyPlan }: GetAnnualSavingsParams
): number {
  const annualPrice = getPrice(country, yearlyPlan);
  const monthlyPrice = getPrice(country, monthlyPlan);
  return monthlyPrice * 12 - annualPrice;
}

export function generateCreditOptions() {
  const tokenPacks = [60, 120, 180, 240];

  return tokenPacks.map((tokens) => {
    const hours = Math.floor(tokens / 60);
    const minutes = tokens % 60;
    let label = `${tokens} tokens (${
      hours > 0 ? `${hours} hour${hours > 1 ? "s" : ""}` : ""
    }${hours > 0 && minutes > 0 ? " and " : ""}${
      minutes > 0 ? `${minutes} minute${minutes > 1 ? "s" : ""}` : ""
    })`;

    return {
      value: tokens,
      label: label,
    };
  });
}

export function getNearestToken(tokens: number): number {
  const base = 60;
  return Math.ceil(tokens / base) * base;
}

/**
 * Reverse-looks up PayAsYouGo price ID to get the country, plan, and token pack.
 * Used during PayStack migration to derive payment amounts from legacy price IDs.
 */
export function getPayAsYouGoInfoFromPriceId(
  priceId: string
): { country: CountryCode; plan: PayAsYouGoPlan; tokens: CreditPack } | null {
  const env: Env = isDev() ? "dev" : "prod";
  const countries = Object.keys(PRICE_IDS[env].PayAsYouGo) as CountryCode[];
  for (const country of countries) {
    const plans = Object.keys(PRICE_IDS[env].PayAsYouGo[country]) as PayAsYouGoPlan[];
    for (const plan of plans) {
      for (const tokens of [60, 120, 180, 240] as CreditPack[]) {
        if (PRICE_IDS[env].PayAsYouGo[country][plan][tokens] === priceId) {
          return { country, plan, tokens };
        }
      }
    }
  }
  return null;
}
