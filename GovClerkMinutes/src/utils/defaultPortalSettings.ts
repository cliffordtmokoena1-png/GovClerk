import type { PublicPortalResponse } from "@/types/portal";

/**
 * Returns default portal settings to use when an organization has not yet
 * been set up in gc_portal_settings.  The page renders the portal shell with
 * these generic values instead of returning a 404.
 */
export function makeDefaultPortalSettings(slug: string): PublicPortalResponse["settings"] {
  return {
    id: 0,
    slug,
    pageTitle: "Public Portal",
    pageDescription: null,
    logoUrl: null,
    headerBgColor: "#1a365d",
    headerTextColor: "#ffffff",
    accentColor: "#3182ce",
    navLinks: null,
  };
}
