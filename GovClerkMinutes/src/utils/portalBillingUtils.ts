/**
 * GovClerk Portal — pro-rata billing utilities.
 *
 * These functions are pure (no DB/network) and can be unit-tested in isolation.
 */

/** Allowed billing days clients can choose. 29/30/31 are excluded to protect February. */
export const ALLOWED_BILLING_DAYS = [1, 15, 25, 26, 28] as const;
export type BillingDay = (typeof ALLOWED_BILLING_DAYS)[number];

/**
 * Given a sign-up date and a preferred billing day, calculate:
 * - daysRemaining: days from signupDate up to (but not including) the next billing day
 * - daysInMonth: total days in the sign-up month (used as the divisor)
 * - proRataFraction: daysRemaining / daysInMonth  (0 < fraction ≤ 1)
 * - proRataAmountZar: fraction × monthlyPriceZar, rounded to 2 decimal places
 * - firstBillingDate: the Date object of the first full billing day
 *
 * Edge cases:
 * - If billingDay === signupDate.getDate(), charge the full month immediately
 *   (fraction = 1, firstBillingDate = next month's billing day).
 * - If billingDay < signupDate.getDate(), the first billing date is in the NEXT month.
 */
export function calculateProRata(
  signupDate: Date,
  billingDay: BillingDay,
  monthlyPriceZar: number
): {
  daysRemaining: number;
  daysInMonth: number;
  proRataFraction: number;
  proRataAmountZar: number;
  firstBillingDate: Date;
} {
  const signupDay = signupDate.getDate();
  const signupMonth = signupDate.getMonth(); // 0-indexed
  const signupYear = signupDate.getFullYear();

  // Days in the sign-up month: new Date(year, month+1, 0) gives last day of month
  const daysInMonth = new Date(signupYear, signupMonth + 1, 0).getDate();

  let firstBillingDate: Date;
  let daysRemaining: number;

  if (billingDay === signupDay) {
    // Same day → charge full month, next billing is one month from now
    daysRemaining = daysInMonth;
    firstBillingDate = new Date(signupYear, signupMonth + 1, billingDay);
  } else if (billingDay > signupDay) {
    // Billing day is later this month
    daysRemaining = billingDay - signupDay;
    firstBillingDate = new Date(signupYear, signupMonth, billingDay);
  } else {
    // Billing day already passed this month → first billing is next month
    daysRemaining = daysInMonth - signupDay + billingDay;
    firstBillingDate = new Date(signupYear, signupMonth + 1, billingDay);
  }

  const proRataFraction = daysRemaining / daysInMonth;
  const proRataAmountZar = Math.round(proRataFraction * monthlyPriceZar * 100) / 100;

  return {
    daysRemaining,
    daysInMonth,
    proRataFraction,
    proRataAmountZar,
    firstBillingDate,
  };
}

/**
 * Pro-rate the monthly token allowance for the first billing period.
 * Returns an integer (floor) so we never over-credit.
 *
 * Example: 29/30 × 2000 = 1933 tokens
 */
export function calculateProRataTokens(
  signupDate: Date,
  billingDay: BillingDay,
  monthlyTokens: number
): number {
  const { proRataFraction } = calculateProRata(signupDate, billingDay, 0);
  return Math.floor(proRataFraction * monthlyTokens);
}

/**
 * Format a ZAR amount for display: "R2 666,67" (South African locale).
 */
export function formatZarAmount(amountZar: number): string {
  const formatted = amountZar.toLocaleString("af-ZA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `R${formatted}`;
}

/**
 * Return a human-readable description of the billing plan for the sign-up confirmation screen.
 * Example: "Your first charge will be R2 666,67 today, then R8 000,00/month from the 25th."
 */
export function buildBillingPreviewText(
  signupDate: Date,
  billingDay: BillingDay,
  monthlyPriceZar: number
): string {
  const { proRataAmountZar, firstBillingDate, daysRemaining, daysInMonth } = calculateProRata(
    signupDate,
    billingDay,
    monthlyPriceZar
  );

  const proRataFormatted = formatZarAmount(proRataAmountZar);
  const fullFormatted = formatZarAmount(monthlyPriceZar);

  if (daysRemaining === daysInMonth) {
    // Same day — charge full month
    return `Your first charge will be ${fullFormatted} today, then ${fullFormatted}/month from the ${billingDay}th.`;
  }

  const billingDateStr = firstBillingDate.toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return `Your first charge will be ${proRataFormatted} today, then ${fullFormatted}/month from ${billingDateStr}.`;
}
