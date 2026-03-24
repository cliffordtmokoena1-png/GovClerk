import { useState } from "react";
import Link from "next/link";
import { LuMenu, LuX, LuFilter, LuLayoutDashboard } from "react-icons/lu";
import { useAuth } from "@clerk/nextjs";
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
  if (settings.logoUrl.includes("govclerk-audio-uploads") && settings.id) {
    return `/api/portal/settings/logo/${settings.id}`;
  }

  // External URLs can be used directly
  return settings.logoUrl;
}

function getSignInUrl(): string {
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    const currentPath = window.location.pathname;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return `/sign-in?redirect=${encodeURIComponent(currentPath)}`;
    }
    return `https://govclerkminutes.com/sign-in?redirect=${encodeURIComponent(currentPath)}`;
  }
  return "https://govclerkminutes.com/sign-in?redirect=/portal";
}

export function PublicPortalHeader({
  settings,
  onMenuToggle,
  onFilterToggle,
}: PublicPortalHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isSignedIn } = useAuth();

  return (
    <header className="sticky top-0 z-40 print:static print:shadow-none">
      {/* Main Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-20 py-3">
            {/* Logo + Organization Name */}
            <div className="flex items-center gap-4">
              {getLogoUrl(settings) && (
                <img
                  src={getLogoUrl(settings)!}
                  alt=""
                  className="h-14 w-auto object-contain"
                  loading="eager"
                />
              )}
              <div className="flex flex-col">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight leading-tight">
                  {settings.pageTitle ?? "Public Records Portal"}
                </h1>
                <p className="text-sm text-gray-500">Public Records Portal</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Navigation Bar */}
      <div
        style={{ backgroundColor: settings.headerBgColor || "#1e3a5f" }}
        className="border-b border-black/10"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-11">
            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-1" aria-label="Main navigation">
              {settings.navLinks?.map((link, index) => (
                <a
                  key={index}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: settings.headerTextColor || "#ffffff" }}
                  className="px-3 py-1.5 text-xs font-medium rounded hover:bg-white/10 transition-colors uppercase tracking-wide"
                >
                  {link.label}
                </a>
              ))}
            </nav>

            {isSignedIn ? (
              <Link
                href="/a/portal"
                style={{ color: settings.headerTextColor || "#ffffff" }}
                className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-white/30 rounded hover:bg-white/10 transition-colors uppercase tracking-wide"
              >
                <LuLayoutDashboard className="w-3.5 h-3.5" />
                Admin Dashboard
              </Link>
            ) : (
              <a
                href={getSignInUrl()}
                style={{ color: settings.headerTextColor || "#ffffff" }}
                className="hidden lg:block px-3 py-1.5 text-xs font-medium border border-white/30 rounded hover:bg-white/10 transition-colors uppercase tracking-wide"
              >
                Sign In
              </a>
            )}

            {/* Mobile: Filter + Hamburger buttons side by side */}
            <div className="lg:hidden flex items-center gap-2">
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
              {settings.navLinks?.map((link, index) => (
                <a
                  key={index}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: settings.headerTextColor || "#ffffff" }}
                  className="px-4 py-3 text-xs font-medium rounded hover:bg-white/10 transition-colors uppercase tracking-wide"
                >
                  {link.label}
                </a>
              ))}
              {isSignedIn ? (
                <Link
                  href="/a/portal"
                  style={{ color: settings.headerTextColor || "#ffffff" }}
                  className="flex items-center gap-1.5 px-4 py-3 text-xs font-medium rounded hover:bg-white/10 transition-colors border-t border-white/10 mt-2 pt-4 uppercase tracking-wide"
                >
                  <LuLayoutDashboard className="w-3.5 h-3.5" />
                  Admin Dashboard
                </Link>
              ) : (
                <a
                  href={getSignInUrl()}
                  style={{ color: settings.headerTextColor || "#ffffff" }}
                  className="px-4 py-3 text-xs font-medium rounded hover:bg-white/10 transition-colors border-t border-white/10 mt-2 pt-4 uppercase tracking-wide"
                >
                  Sign In
                </a>
              )}
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
