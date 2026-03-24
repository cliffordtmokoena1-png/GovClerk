export type Site = "GovClerk" | "GovClerkMinutes";
export const SITE_HEADER = "x-mg-site";

const GOVCLERK_DOMAINS = ["govclerk.com", "www.govclerk.com"];

export function getSiteFromHost(host: string | null | undefined): Site {
    if (!host) return "GovClerkMinutes";
    const hostname = host.split(':')[0].toLowerCase();
    if (GOVCLERK_DOMAINS.includes(hostname)) {
        return "GovClerk";
    }
    if (hostname.includes("govclerk") && !hostname.includes("minutes")) {
        return "GovClerk";
    }
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

export function getSiteFromHeaders(headers: Headers): Site {
    const value = headers.get(SITE_HEADER);
    return value === "GovClerk" ? "GovClerk" : "GovClerkMinutes";
}

export function getSiteFromRequest(request: Request): Site {
    const headers = request.headers;
    return getSiteFromHeaders(headers);
}