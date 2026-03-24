import type { IncomingHttpHeaders } from "http";

export type Site = "GovClerk" | "GovClerkMinutes";
export const SITE_HEADER = "x-gc-site";

const GOVCLERK_DOMAINS = ["govclerk.com", "www.govclerk.com"];

export function getSiteFromHost(host: string | null | undefined): Site {
  if (!host) return "GovClerkMinutes";
  const hostname = host.split(":")[0].toLowerCase();

  if (GOVCLERK_DOMAINS.includes(hostname)) return "GovClerk";
  if (hostname.includes("govclerk") && !hostname.includes("minutes")) return "GovClerk";

  return "GovClerkMinutes";
}

export function getSiteFromWindow(): Site {
  if (typeof window === "undefined") return "GovClerkMinutes";
  return getSiteFromHost(window.location.host);
}

export function isGovClerk(site: Site): boolean {
  return site === "GovClerk";
}

export function isGovClerkMinutes(site: Site): boolean {
  return site === "GovClerkMinutes";
}

export function getSiteFromHeaders(
  headers: Headers | IncomingHttpHeaders | Record<string, string | string[] | undefined>
): Site {
  // Fetch Headers (Request / Edge)
  if (typeof (headers as Headers).get === "function") {
    const h = headers as Headers;

    const explicit = h.get(SITE_HEADER);
    if (explicit === "GovClerk") return "GovClerk";
    if (explicit === "GovClerkMinutes") return "GovClerkMinutes";

    const xfHost = h.get("x-forwarded-host");
    const host = h.get("host");
    return getSiteFromHost(xfHost ?? host);
  }

  // Node/Next headers object
  const h = headers as IncomingHttpHeaders;

  const explicit = h[SITE_HEADER] ?? h[SITE_HEADER.toLowerCase()];
  const explicitValue = Array.isArray(explicit) ? explicit[0] : explicit;
  if (explicitValue === "GovClerk") return "GovClerk";
  if (explicitValue === "GovClerkMinutes") return "GovClerkMinutes";

  const xfHost = h["x-forwarded-host"];
  const host = h["host"];
  const xfHostValue = Array.isArray(xfHost) ? xfHost[0] : xfHost;
  const hostValue = Array.isArray(host) ? host[0] : host;

  return getSiteFromHost(xfHostValue ?? hostValue);
}

export function getSiteFromRequest(
  request:
    | Request
    | { headers: Headers | IncomingHttpHeaders | Record<string, string | string[] | undefined> }
): Site {
  return getSiteFromHeaders(request.headers as any);
}