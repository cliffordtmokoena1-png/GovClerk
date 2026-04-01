/**
 * Free / personal email provider blocklist.
 *
 * Any email whose domain appears in this set is considered a personal address
 * and is not accepted for portal registration. All other domains are treated
 * as organisational emails.
 *
 * Domains are stored in lowercase; comparisons must be case-insensitive.
 */

export const FREE_EMAIL_PROVIDERS: ReadonlySet<string> = new Set([
  // Google
  "gmail.com",
  "googlemail.com",

  // Microsoft / Live
  "outlook.com",
  "hotmail.com",
  "hotmail.co.uk",
  "hotmail.fr",
  "live.com",
  "live.co.uk",
  "live.fr",
  "msn.com",
  "windowslive.com",

  // Yahoo
  "yahoo.com",
  "yahoo.co.uk",
  "yahoo.fr",
  "yahoo.de",
  "yahoo.es",
  "yahoo.it",
  "ymail.com",

  // Apple
  "icloud.com",
  "me.com",
  "mac.com",

  // ProtonMail
  "protonmail.com",
  "protonmail.ch",
  "proton.me",
  "pm.me",

  // GMX
  "gmx.com",
  "gmx.net",
  "gmx.de",
  "gmx.at",
  "gmx.ch",

  // AOL
  "aol.com",
  "aol.co.uk",

  // Mail.com / 1&1
  "mail.com",
  "email.com",
  "usa.com",
  "hushmail.com",
  "hush.com",

  // Zoho
  "zoho.com",
  "zohomail.com",
  "zoho.in",

  // Yandex
  "yandex.com",
  "yandex.ru",
  "ya.ru",
  "yandex.ua",

  // FastMail
  "fastmail.com",
  "fastmail.fm",
  "fastmail.to",

  // Tutanota / Tuta
  "tutanota.com",
  "tutanota.de",
  "tuta.io",
  "tuta.com",

  // Mailfence / Posteo / Runbox
  "mailfence.com",
  "posteo.net",
  "runbox.com",

  // Disposable / temporary providers
  "mailinator.com",
  "guerrillamail.com",
  "guerrillamail.net",
  "guerrillamail.org",
  "guerrillamail.biz",
  "guerrillamail.de",
  "guerrillamail.info",
  "tempmail.com",
  "throwaway.email",
  "sharklasers.com",
  "guerrillamailblock.com",
  "grr.la",
  "spam4.me",
  "yopmail.com",
  "yopmail.fr",
  "cool.fr.nf",
  "jetable.fr.nf",
  "nospam.ze.tc",
  "nomail.xl.cx",
  "mega.zik.dj",
  "speed.1s.fr",
  "courriel.fr.nf",
  "moncourrier.fr.nf",
  "monemail.fr.nf",
  "monmail.fr.nf",
  "trashmail.com",
  "trashmail.at",
  "trashmail.io",
  "trashmail.me",
  "trashmail.net",
  "dispostable.com",
  "mailnull.com",
  "spamgourmet.com",
  "10minutemail.com",
  "10minutemail.net",
  "tempr.email",
  "discard.email",
  "fakeinbox.com",
  "maildrop.cc",
  "getnada.com",
  "mailsac.com",

  // Other popular free providers
  "inbox.com",
  "rocketmail.com",
  "rediffmail.com",
  "web.de",
  "freenet.de",
  "t-online.de",
  "orange.fr",
  "laposte.net",
  "sfr.fr",
  "free.fr",
  "wanadoo.fr",
  "libero.it",
  "virgilio.it",
  "tin.it",
  "alice.it",
  "rambler.ru",
  "mail.ru",
  "list.ru",
  "bk.ru",
  "inbox.ru",
]);

/**
 * Returns true if the email address belongs to a known free/personal email provider.
 * The comparison is case-insensitive.
 */
export function isFreeEmailProvider(email: string): boolean {
  const lower = email.toLowerCase().trim();
  const atIndex = lower.lastIndexOf("@");
  if (atIndex === -1) {
    return false;
  }
  const domain = lower.slice(atIndex + 1);
  return FREE_EMAIL_PROVIDERS.has(domain);
}

/**
 * Returns true if the email address is an organisational email (i.e. NOT from a
 * known free/personal email provider). This is the primary gate for portal access.
 */
export function isOrganizationalEmail(email: string): boolean {
  return !isFreeEmailProvider(email);
}
