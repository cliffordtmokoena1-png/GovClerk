export const CAMPAIGNS = {
  POST_PURCHASE: "ca1bb64d-1263-4d1c-ba9a-b5e327e3f2fa",
  SIGNUP_URGENT: "4ea94d08-5e9f-4d39-8e1b-0090ce895b82",
  WEBINAR_01: "83a3797b-bb09-430c-a858-d6894650d2e9",
  AFTER_WEBINAR: "6f2185bc-52ae-4671-8bf7-b9e5e572b2e3",
  PAYWALL_ABANDONERS: "7c60bac9-0025-4af3-b9e1-5b2838a22f72",
  EMPTY: "17b2910c-15f2-4f3f-8699-db151e8960ab",
} as const;

export type Campaign = (typeof CAMPAIGNS)[keyof typeof CAMPAIGNS];
