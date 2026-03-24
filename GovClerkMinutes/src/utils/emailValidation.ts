const PERSONAL_EMAIL_DOMAINS = [
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "aol.com",
  "icloud.com",
  "mail.com",
  "protonmail.com",
  "zoho.com",
  "yandex.com",
  "gmx.com",
  "live.com",
  "msn.com",
  "yahoo.co.uk",
  "yahoo.ca",
  "googlemail.com",
  "me.com",
  "mac.com",
] as const;

export function getEmailDomain(email: string): string | null {
  if (!email?.includes("@")) {
    return null;
  }

  return email.trim().toLowerCase().split("@")[1] ?? null;
}

export function isPersonalEmail(email: string): boolean {
  const domain = getEmailDomain(email);
  return (
    domain != null &&
    PERSONAL_EMAIL_DOMAINS.includes(domain as (typeof PERSONAL_EMAIL_DOMAINS)[number])
  );
}

export { PERSONAL_EMAIL_DOMAINS };
