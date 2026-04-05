import { SubscriptionPlan } from "@/utils/price";

/**
 * Returns the maximum number of team members (including the account owner)
 * allowed for the given subscription plan.
 */
export function getMaxMembers(plan: SubscriptionPlan): number {
  switch (plan) {
    case "Essential":
    case "Essential_Annual":
    case "Basic":
    case "Basic_Annual":
      return 2;
    case "Professional":
    case "Professional_Annual":
    case "Pro":
    case "Pro_Annual":
      return 4;
    case "Elite":
    case "Elite_Annual":
      return 6;
    case "Premium":
    case "Premium_Annual":
      return 10;
    case "Free":
    default:
      return 1;
  }
}
