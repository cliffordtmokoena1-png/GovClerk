function getBrevoListId(name: string): number {
  const value = process.env[name];
  const parsed = Number(value);

  if (!value || !Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Missing or invalid required Brevo list id environment variable: ${name}`);
  }

  return parsed;
}

export const BREVO_LISTS = {
  POST_PURCHASE: getBrevoListId("BREVO_LIST_POST_PURCHASE"),
  SIGNUP_URGENT: getBrevoListId("BREVO_LIST_SIGNUP_URGENT"),
  WEBINAR_01: getBrevoListId("BREVO_LIST_WEBINAR"),
  AFTER_WEBINAR: getBrevoListId("BREVO_LIST_AFTER_WEBINAR"),
  PAYWALL_ABANDONERS: getBrevoListId("BREVO_LIST_PAYWALL_ABANDONERS"),
  APOLLO_LEADS: getBrevoListId("BREVO_LIST_APOLLO_LEADS"),
} as const;

export type BrevoListId = (typeof BREVO_LISTS)[keyof typeof BREVO_LISTS];
