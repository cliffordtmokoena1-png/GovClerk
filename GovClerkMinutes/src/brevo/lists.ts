export const BREVO_LISTS = {
  POST_PURCHASE: Number(process.env.BREVO_LIST_POST_PURCHASE ?? "0"),
  SIGNUP_URGENT: Number(process.env.BREVO_LIST_SIGNUP_URGENT ?? "0"),
  WEBINAR_01: Number(process.env.BREVO_LIST_WEBINAR ?? "0"),
  AFTER_WEBINAR: Number(process.env.BREVO_LIST_AFTER_WEBINAR ?? "0"),
  PAYWALL_ABANDONERS: Number(process.env.BREVO_LIST_PAYWALL_ABANDONERS ?? "0"),
  APOLLO_LEADS: Number(process.env.BREVO_LIST_APOLLO_LEADS ?? "0"),
} as const;

export type BrevoListId = (typeof BREVO_LISTS)[keyof typeof BREVO_LISTS];
