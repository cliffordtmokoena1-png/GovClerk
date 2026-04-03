import { useState, useCallback } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import {
  LuMenu,
  LuX,
  LuFilter,
  LuLayoutDashboard,
  LuLogIn,
  LuLogOut,
  LuUser,
  LuHome,
  LuCalendar,
  LuFolder,
  LuBell,
  LuFileText,
  LuRss,
} from "react-icons/lu";
import { usePortalSession } from "@/hooks/portal/usePortalSession";
import type { PublicPortalResponse } from "@/types/portal";

interface PublicPortalHeaderProps {
  settings: PublicPortalResponse["settings"];
  onMenuToggle?: () => void;
  onFilterToggle?: () => void;
}

/** Get logo URL - uses presigned URL API for S3 logos */
function getLogoUrl(settings: PublicPortalResponse["settings"]): string | null {
  if (!settings.logoUrl) {
    return null;
  }

  // If logo is from our S3 bucket, use the API endpoint
  if (settings.logoUrl.includes("govclerk-bucket") && settings.id) {
    return `/api/portal/settings/logo/${settings.id}`;
  }

  // External URLs can be used directly
  return settings.logoUrl;
}

// Phase 3 portal navigation links
const PORTAL_NAV_LINKS = [
  { label: "Home", hrefSuffix: "", icon: LuHome },
  { label: "Calendar", hrefSuffix: "/calendar", icon: LuCalendar },
  { label: "Public Records", hrefSuffix: "/records", icon: LuFolder },
  { label: "Notices", hrefSuffix: "/notices", icon: LuBell },
  { label: "Request Records", hrefSuffix: "/request-records", icon: LuFileText },
];

export function PublicPortalHeader({
  settings,
  onMenuToggle,
  onFilterToggle,
}: PublicPortalHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { session, refresh: refreshSession } = usePortalSession();
  const router = useRouter();

  // Derive the slug from the current URL path (/portal/[slug]/...)
  const slug = router.query.slug as string | undefined;

  const handlePortalSignOut = useCallback(async () => {
    await fetch("/api/portal/auth/logout", { method: "POST" });
    await refreshSession();
    if (slug) {
      router.push(`/portal/${slug}/sign-in`);
    }
  }, [slug, router, refreshSession]);

  const portalSignInUrl = slug ? `/portal/${slug}/sign-in` : "#";

  return (
    <header className="sticky top-0 z-40 print:static print:shadow-none">
      {/* Single dark navbar */}
      <div
        style={{ backgroundColor: settings.headerBgColor || "#1e3a5f" }}
        className="border-b border-black/10"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between min-h-[64px] py-3">
            {/* Left: Logo + Org Name */}
            <div className="flex items-center gap-3 shrink-0">
              {getLogoUrl(settings) && (
                <img
                  src={getLogoUrl(settings)!}
                  alt=""
                  className="h-10 w-auto object-contain"
                  loading="eager"
                />
              )}
              <span
                style={{ color: settings.headerTextColor || "#ffffff" }}
                className="font-bold text-base leading-tight"
              >
                {settings.pageTitle && settings.pageTitle !== "Demo Portal"
                  ? settings.pageTitle
                  : "Public Records Portal"}
              </span>
            </div>

            {/* Center/Left: Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-1 ml-6" aria-label="Main navigation">
              {/* Phase 3 built-in portal nav links */}
              {slug &&
                PORTAL_NAV_LINKS.map((link) => {
                  const Icon = link.icon;
                  return (
                    <Link
                      key={link.label}
                      href={`/portal/${slug}${link.hrefSuffix}`}
                      style={{ color: settings.headerTextColor || "#ffffff" }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded hover:bg-white/10 transition-colors uppercase tracking-wide focus:outline-none focus:ring-2 focus:ring-white/50"
                    >
                      <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                      {link.label}
                    </Link>
                  );
                })}
              {/* RSS Feed link */}
              {slug && (
                <a
                  href={`/api/public/portal/${slug}/feed`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Subscribe to RSS Feed"
                  style={{ color: settings.headerTextColor || "#ffffff" }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded hover:bg-white/10 transition-colors uppercase tracking-wide focus:outline-none focus:ring-2 focus:ring-white/50"
                >
                  <LuRss className="w-3.5 h-3.5" aria-hidden="true" />
                  RSS Feed
                </a>
              )}
              {/* Additional custom nav links from portal settings */}
              {settings.navLinks?.map((link, index) => (
                <a
                  key={index}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: settings.headerTextColor || "#ffffff" }}
                  className="px-3 py-1.5 text-xs font-medium rounded hover:bg-white/10 transition-colors uppercase tracking-wide focus:outline-none focus:ring-2 focus:ring-white/50"
                >
                  {link.label}
                </a>
              ))}
            </nav>

            {/* Right: Desktop auth actions */}
            <div className="hidden lg:flex items-center gap-2 ml-auto">
              {session?.isAuthenticated ? (
                <div className="flex items-center gap-2">
                  <span
                    style={{ color: settings.headerTextColor || "#ffffff" }}
                    className="flex items-center gap-1 text-xs opacity-80"
                  >
                    <LuUser className="w-3.5 h-3.5" />
                    {session.email ?? "Signed in"}
                  </span>
                  {/* Admin settings link — only for portal admins */}
                  {(session.role === "admin" || session.isGovClerkAdmin) && slug && (
                    <Link
                      href={`/portal/${slug}/admin`}
                      style={{ color: settings.headerTextColor || "#ffffff" }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-white/30 rounded hover:bg-white/10 transition-colors uppercase tracking-wide"
                    >
                      <LuLayoutDashboard className="w-3.5 h-3.5" />
                      Org Dashboard
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={handlePortalSignOut}
                    style={{ color: settings.headerTextColor || "#ffffff" }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-white/30 rounded hover:bg-white/10 transition-colors uppercase tracking-wide"
                  >
                    <LuLogOut className="w-3.5 h-3.5" />
                    Sign Out
                  </button>
                </div>
              ) : (
                <Link
                  href={portalSignInUrl}
                  style={{ color: settings.headerTextColor || "#ffffff" }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-white/30 rounded hover:bg-white/10 transition-colors uppercase tracking-wide"
                >
                  <LuLogIn className="w-3.5 h-3.5" />
                  Sign In
                </Link>
              )}
            </div>

            {/* Mobile: Filter + Hamburger buttons side by side */}
            <div className="lg:hidden flex items-center gap-2 ml-auto">
              {/* Filter button */}
              <button
                type="button"
                onClick={() => onFilterToggle?.()}
                className="p-2 rounded-md hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/30"
                style={{ color: settings.headerTextColor || "#ffffff" }}
                aria-label="Open filters"
              >
                <LuFilter className="w-5 h-5" aria-hidden="true" />
              </button>

              {/* Hamburger menu button */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="flex items-center gap-2 p-2 rounded-md hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/30"
                aria-label="Toggle navigation menu"
                aria-expanded={mobileMenuOpen}
              >
                {mobileMenuOpen ? (
                  <LuX
                    style={{ color: settings.headerTextColor || "#ffffff" }}
                    className="h-6 w-6"
                    aria-hidden="true"
                  />
                ) : (
                  <LuMenu
                    style={{ color: settings.headerTextColor || "#ffffff" }}
                    className="h-6 w-6"
                    aria-hidden="true"
                  />
                )}
                <span
                  style={{ color: settings.headerTextColor || "#ffffff" }}
                  className="text-sm font-medium"
                >
                  Menu
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Dropdown */}
      {mobileMenuOpen && (
        <div
          style={{ backgroundColor: settings.headerBgColor || "#1e3a5f" }}
          className="lg:hidden border-b border-black/10"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
            <nav className="flex flex-col gap-1" aria-label="Mobile navigation">
              {/* Phase 3 built-in portal nav links */}
              {slug &&
                PORTAL_NAV_LINKS.map((link) => {
                  const Icon = link.icon;
                  return (
                    <Link
                      key={link.label}
                      href={`/portal/${slug}${link.hrefSuffix}`}
                      style={{ color: settings.headerTextColor || "#ffffff" }}
                      className="flex items-center gap-2 px-4 py-3 text-xs font-medium rounded hover:bg-white/10 transition-colors uppercase tracking-wide focus:outline-none focus:ring-2 focus:ring-white/50"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                      {link.label}
                    </Link>
                  );
                })}
              {/* RSS Feed link */}
              {slug && (
                <a
                  href={`/api/public/portal/${slug}/feed`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Subscribe to RSS Feed"
                  style={{ color: settings.headerTextColor || "#ffffff" }}
                  className="flex items-center gap-2 px-4 py-3 text-xs font-medium rounded hover:bg-white/10 transition-colors uppercase tracking-wide focus:outline-none focus:ring-2 focus:ring-white/50"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <LuRss className="w-3.5 h-3.5" aria-hidden="true" />
                  RSS Feed
                </a>
              )}
              {/* Additional custom nav links */}
              {settings.navLinks?.map((link, index) => (
                <a
                  key={index}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: settings.headerTextColor || "#ffffff" }}
                  className="px-4 py-3 text-xs font-medium rounded hover:bg-white/10 transition-colors uppercase tracking-wide focus:outline-none focus:ring-2 focus:ring-white/50"
                >
                  {link.label}
                </a>
              ))}
              {/* Portal session in mobile menu */}
              {session?.isAuthenticated ? (
                <div className="border-t border-white/10 mt-2 pt-4">
                  <span
                    style={{ color: settings.headerTextColor || "#ffffff" }}
                    className="flex items-center gap-1 px-4 py-1 text-xs opacity-70"
                  >
                    <LuUser className="w-3.5 h-3.5" />
                    {session.email ?? "Signed in"}
                  </span>
                  {/* Admin settings link — only for portal admins */}
                  {(session.role === "admin" || session.isGovClerkAdmin) && slug && (
                    <Link
                      href={`/portal/${slug}/admin`}
                      style={{ color: settings.headerTextColor || "#ffffff" }}
                      className="flex items-center gap-1.5 px-4 py-3 text-xs font-medium rounded hover:bg-white/10 transition-colors w-full uppercase tracking-wide"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <LuLayoutDashboard className="w-3.5 h-3.5" />
                      Org Dashboard
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={handlePortalSignOut}
                    style={{ color: settings.headerTextColor || "#ffffff" }}
                    className="flex items-center gap-1.5 px-4 py-3 text-xs font-medium rounded hover:bg-white/10 transition-colors w-full uppercase tracking-wide"
                  >
                    <LuLogOut className="w-3.5 h-3.5" />
                    Sign Out
                  </button>
                </div>
              ) : (
                <Link
                  href={portalSignInUrl}
                  style={{ color: settings.headerTextColor || "#ffffff" }}
                  className="flex items-center gap-1.5 px-4 py-3 text-xs font-medium rounded hover:bg-white/10 transition-colors border-t border-white/10 mt-2 pt-4 uppercase tracking-wide"
                >
                  <LuLogIn className="w-3.5 h-3.5" />
                  Sign In
                </Link>
              )}
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
