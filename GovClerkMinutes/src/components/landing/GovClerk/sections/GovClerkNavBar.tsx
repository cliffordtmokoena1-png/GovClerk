import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@clerk/nextjs";
import { RxHamburgerMenu } from "react-icons/rx";
import { IoClose } from "react-icons/io5";
import { LuChevronDown, LuArrowRight } from "react-icons/lu";
import {
  LuCalendar,
  LuFileText,
  LuMic,
  LuUsers,
  LuClipboardCheck,
  LuGlobe,
  LuShield,
  LuZap,
  LuBookOpen,
  LuMessageSquare,
  LuHelpCircle,
  LuNewspaper,
  LuBuilding2,
  LuGraduationCap,
  LuHeart,
  LuLandmark,
} from "react-icons/lu";
import { GovClerk_ANNOUNCEMENT_BAR_HEIGHT } from "./GovClerkAnnouncementBar";

type MegaMenuItem = {
  icon: typeof LuCalendar;
  title: string;
  description: string;
  href: string;
  featured?: boolean;
  destination?: "govclerkminutes" | "portal";
};

const GOVCLERK_SIGN_IN_URL = "https://govclerkminutes.com/sign-in";
const GOVCLERK_DASHBOARD_URL = "https://govclerkminutes.com/dashboard";
const GOVCLERK_PORTAL_SIGN_IN_URL = "https://govclerkminutes.com/portal/govclerkminutes/sign-in";

type FeedItem = {
  tag: string;
  title: string;
  href: string;
};

const productItems: MegaMenuItem[] = [
  {
    icon: LuCalendar,
    title: "Agenda Management",
    description: "Create, organize, and distribute meeting agendas to stakeholders digitally",
    href: GOVCLERK_SIGN_IN_URL,
    featured: true,
    destination: "govclerkminutes",
  },
  {
    icon: LuFileText,
    title: "Minutes Generation",
    description: "AI transforms recordings into structured, professional meeting minutes",
    href: GOVCLERK_SIGN_IN_URL,
    featured: true,
    destination: "govclerkminutes",
  },
  {
    icon: LuMic,
    title: "Transcription",
    description: "Real-time speech-to-text with speaker labels in 96+ languages",
    href: GOVCLERK_SIGN_IN_URL,
    destination: "govclerkminutes",
  },
  {
    icon: LuUsers,
    title: "Organization Management",
    description: "Manage boards, committees, departments, and member roles centrally",
    href: GOVCLERK_PORTAL_SIGN_IN_URL,
    destination: "portal",
  },
  {
    icon: LuClipboardCheck,
    title: "Votes & Motions",
    description: "Record, track, and archive motions, votes, and resolutions",
    href: GOVCLERK_PORTAL_SIGN_IN_URL,
    destination: "portal",
  },
  {
    icon: LuShield,
    title: "Security & Compliance",
    description: "SOC 2 compliant with encryption and role-based access controls",
    href: "/product/security",
  },
  {
    icon: LuZap,
    title: "AI-Powered Artifacts",
    description: "Auto-extract action items, summaries, and key decisions",
    href: GOVCLERK_SIGN_IN_URL,
    destination: "govclerkminutes",
  },
];

const solutionItems: MegaMenuItem[] = [
  {
    icon: LuLandmark,
    title: "Local Government",
    description: "City councils, county boards, and municipal agencies",
    href: GOVCLERK_PORTAL_SIGN_IN_URL,
    featured: true,
    destination: "portal",
  },
  {
    icon: LuGraduationCap,
    title: "School Boards",
    description: "K-12 districts, higher education boards, and academic committees",
    href: GOVCLERK_PORTAL_SIGN_IN_URL,
    featured: true,
    destination: "portal",
  },
  {
    icon: LuBuilding2,
    title: "Special Districts",
    description: "Water, fire, transit, and utility districts with public meetings",
    href: GOVCLERK_PORTAL_SIGN_IN_URL,
    destination: "portal",
  },
  {
    icon: LuHeart,
    title: "Nonprofits",
    description: "Board governance and volunteer committee management",
    href: GOVCLERK_PORTAL_SIGN_IN_URL,
    destination: "portal",
  },
];

const resourceItems: MegaMenuItem[] = [
  {
    icon: LuBookOpen,
    title: "Documentation",
    description: "Guides, API references, and integration documentation",
    href: "/docs",
  },
  {
    icon: LuNewspaper,
    title: "Blog",
    description: "Product updates, best practices, and industry insights",
    href: "/blog",
  },
  {
    icon: LuHelpCircle,
    title: "Help Center",
    description: "FAQs, tutorials, and support resources",
    href: "/help",
  },
  {
    icon: LuMessageSquare,
    title: "Contact Us",
    description: "Get in touch with our team for questions or support",
    href: "/contact",
  },
];

const feedItems: FeedItem[] = [
  {
    tag: "Product",
    title: "Introducing AI-powered agenda generation for council meetings",
    href: "/blog",
  },
  {
    tag: "Guide",
    title: "How to migrate from paper minutes to digital in 30 days",
    href: "/blog",
  },
  {
    tag: "Update",
    title: "New SOC 2 Type II certification and compliance dashboard",
    href: "/blog",
  },
];

type NavDropdown = {
  key: string;
  label: string;
  items: MegaMenuItem[];
};

const navDropdowns: NavDropdown[] = [
  { key: "product", label: "Product", items: productItems },
  { key: "solutions", label: "Solutions", items: solutionItems },
  { key: "resources", label: "Resources", items: resourceItems },
];

type BentoMenuPanelProps = {
  items: MegaMenuItem[];
  dropdownKey: string;
  getItemHref: (item: MegaMenuItem) => string;
};

function BentoMenuPanel({ items, dropdownKey, getItemHref }: BentoMenuPanelProps) {
  const featured = items.filter((item) => item.featured);
  const standard = items.filter((item) => !item.featured);
  const showFeed = dropdownKey === "product" || dropdownKey === "resources";

  return (
    <div className={`grid gap-10 ${showFeed ? "grid-cols-[1fr_280px]" : "grid-cols-1"}`}>
      {/* Main content area */}
      <div>
        {/* Featured items as larger cards */}
        {featured.length > 0 && (
          <div
            className={`mb-6 grid gap-4 ${featured.length === 2 ? "grid-cols-2" : "grid-cols-1"}`}
          >
            {featured.map((item) => {
              const IconComponent = item.icon;
              return (
                <Link
                  key={item.title}
                  href={getItemHref(item)}
                  className="group flex gap-4 rounded-xl border border-gray-100 bg-gray-50/50 p-6 transition-all hover:border-blue-100 hover:bg-blue-50/30 hover:shadow-sm"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-cd-blue/10">
                    <IconComponent className="h-5 w-5 text-cd-blue" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                      <LuArrowRight className="h-3.5 w-3.5 -translate-x-1 text-gray-400 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-gray-500">{item.description}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Standard items in grid */}
        {standard.length > 0 && (
          <div className={`grid gap-1 ${standard.length > 3 ? "grid-cols-2" : "grid-cols-1"}`}>
            {standard.map((item) => {
              const IconComponent = item.icon;
              return (
                <Link
                  key={item.title}
                  href={getItemHref(item)}
                  className="group flex gap-4 rounded-lg px-4 py-3 transition-colors hover:bg-gray-50"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50">
                    <IconComponent className="h-4.5 w-4.5 text-cd-blue" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium text-gray-900">{item.title}</p>
                      <LuArrowRight className="h-3 w-3 -translate-x-1 text-gray-400 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                    </div>
                    <p className="mt-0.5 text-xs leading-relaxed text-gray-500">
                      {item.description}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {showFeed && (
        <div className="border-l border-gray-100 pl-10">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-400">
            What&apos;s New
          </p>
          <div className="flex flex-col gap-5">
            {feedItems.map((feed) => (
              <Link
                key={feed.title}
                href={feed.href}
                className="group block rounded-lg transition-colors"
              >
                <span className="mb-1.5 inline-block rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-cd-blue">
                  {feed.tag}
                </span>
                <p className="text-sm leading-snug text-gray-700 transition-colors group-hover:text-cd-blue">
                  {feed.title}
                </p>
              </Link>
            ))}
          </div>
          <Link
            href="/blog"
            className="mt-5 inline-flex items-center gap-1 text-xs font-medium text-cd-blue hover:underline"
          >
            View all updates
            <LuArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}
    </div>
  );
}

export default function GovClerkNavBar() {
  const { isLoaded, userId } = useAuth();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const dropdownTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mobileExpanded, setMobileExpanded] = useState<string | null>(null);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsMenuOpen(false);
      setIsClosing(false);
      setMobileExpanded(null);
    }, 200);
  };

  const handleDropdownEnter = (key: string) => {
    if (dropdownTimeoutRef.current) {
      clearTimeout(dropdownTimeoutRef.current);
      dropdownTimeoutRef.current = null;
    }
    setActiveDropdown(key);
  };

  const handleDropdownLeave = () => {
    dropdownTimeoutRef.current = setTimeout(() => {
      setActiveDropdown(null);
    }, 150);
  };

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    return () => {
      if (dropdownTimeoutRef.current) {
        clearTimeout(dropdownTimeoutRef.current);
      }
    };
  }, []);

  const navTopOffset = GovClerk_ANNOUNCEMENT_BAR_HEIGHT;

  const getItemHref = (item: MegaMenuItem): string => {
    if (item.destination === "govclerkminutes") {
      return isLoaded && userId ? GOVCLERK_DASHBOARD_URL : GOVCLERK_SIGN_IN_URL;
    }
    return item.href;
  };

  return (
    <>
      {/* Desktop nav */}
      <nav
        className={`sticky left-0 right-0 z-[100] w-full bg-white transition-shadow duration-300 ${
          isScrolled
            ? "shadow-[0_1px_3px_0_rgba(0,0,0,0.1),0_1px_2px_-1px_rgba(0,0,0,0.1)]"
            : "shadow-[0_1px_0_0_rgba(0,0,0,0.06)]"
        }`}
        style={{ top: `${navTopOffset}px` }}
      >
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex h-20 items-center justify-between">
            {/* Left: logo + nav */}
            <div className="flex items-center gap-10">
              <Link
                href="/"
                className="flex items-center gap-2 transition-transform hover:scale-[1.02]"
              >
                <Image
                  src="/govclerk-logo.svg"
                  alt="GovClerk"
                  width={400}
                  height={120}
                  className="w-[200px] h-auto"
                />
              </Link>

              {/* Desktop dropdowns + pricing link */}
              <div className="hidden items-center gap-1 md:flex">
                {navDropdowns.map((dropdown) => (
                  <div
                    key={dropdown.key}
                    className="relative"
                    onMouseEnter={() => handleDropdownEnter(dropdown.key)}
                    onMouseLeave={handleDropdownLeave}
                  >
                    <button
                      type="button"
                      aria-haspopup="true"
                      aria-expanded={activeDropdown === dropdown.key}
                      aria-controls={`mega-panel-${dropdown.key}`}
                      className="flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 hover:text-gray-900"
                    >
                      {dropdown.label}
                      <LuChevronDown
                        className={`h-4 w-4 transition-transform duration-200 ${
                          activeDropdown === dropdown.key ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                  </div>
                ))}
                <div
                  className="relative"
                  onMouseEnter={() => handleDropdownEnter("pricing")}
                  onMouseLeave={handleDropdownLeave}
                >
                  <button
                    type="button"
                    aria-haspopup="true"
                    aria-expanded={activeDropdown === "pricing"}
                    aria-controls="mega-panel-pricing"
                    className="flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 hover:text-gray-900"
                  >
                    Pricing
                    <LuChevronDown
                      className={`h-4 w-4 transition-transform duration-200 ${
                        activeDropdown === "pricing" ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                </div>
                <a
                  href="https://calendly.com/cliff-govclerkminutes/30min"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 hover:text-gray-900"
                >
                  Book a Demo
                </a>
              </div>
            </div>

            {/* Right: desktop CTA */}
            <div className="hidden items-center gap-3 md:flex">
              {isLoaded && !userId ? (
                <>
                  <a
                    href="https://govclerkpartners.org"
                    className="flex items-center gap-1.5 rounded-md border border-green-600 px-4 py-2 text-sm font-medium text-green-700 transition-all hover:bg-green-50"
                  >
                    <LuGlobe className="h-4 w-4" />
                    Public Portal
                  </a>
                  <Link
                    href="/sign-in"
                    className="rounded-md px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/overview"
                    className="rounded-md border border-cd-blue px-4 py-2 text-sm font-medium text-cd-blue transition-all hover:bg-blue-50"
                  >
                    Watch Overview
                  </Link>
                  <a
                    href="https://calendly.com/cliff-govclerkminutes/30min"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-md bg-cd-blue px-4 py-2 text-sm font-medium text-white transition-all hover:bg-cd-blue-dark hover:shadow-md"
                  >
                    Book a Demo
                  </a>
                </>
              ) : (
                <>
                  <a
                    href="https://govclerkpartners.org"
                    className="flex items-center gap-1.5 rounded-md border border-green-600 px-4 py-2 text-sm font-medium text-green-700 transition-all hover:bg-green-50"
                  >
                    <LuGlobe className="h-4 w-4" />
                    Public Portal
                  </a>
                  <Link
                    href="/dashboard"
                    className="rounded-md bg-cd-blue px-4 py-2 text-sm font-medium text-white transition-all hover:bg-cd-blue-dark hover:shadow-md"
                  >
                    Dashboard
                  </Link>
                </>
              )}
            </div>

            {/* Right: mobile CTA + hamburger */}
            <div className="flex items-center gap-2 md:hidden">
              {isLoaded && !userId ? (
                <a
                  href="https://calendly.com/cliff-govclerkminutes/30min"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md bg-cd-blue px-3 py-1.5 text-xs font-medium text-white hover:bg-cd-blue-dark sm:px-4 sm:py-2 sm:text-sm"
                >
                  Book a Demo
                </a>
              ) : (
                <>
                  <a
                    href="https://govclerkpartners.org"
                    className="flex items-center gap-1.5 rounded-md border border-green-600 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-50 sm:px-4 sm:py-2 sm:text-sm"
                  >
                    <LuGlobe className="h-4 w-4" />
                    Portal
                  </a>
                  <Link
                    href="/dashboard"
                    className="rounded-md bg-cd-blue px-3 py-1.5 text-xs font-medium text-white hover:bg-cd-blue-dark sm:px-4 sm:py-2 sm:text-sm"
                  >
                    Dashboard
                  </Link>
                </>
              )}
              <button
                type="button"
                aria-label={isMenuOpen ? "Close menu" : "Open menu"}
                onClick={isMenuOpen ? handleClose : () => setIsMenuOpen(true)}
                className="rounded-md p-1.5 text-gray-700 transition-colors hover:bg-gray-100 sm:p-2"
              >
                {isMenuOpen ? (
                  <IoClose className="h-5 w-5" />
                ) : (
                  <RxHamburgerMenu className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Desktop mega menu dropdowns */}
        {navDropdowns.map((dropdown) => (
          <div
            key={dropdown.key}
            id={`mega-panel-${dropdown.key}`}
            role="menu"
            className={`absolute left-0 right-0 top-full border-t border-gray-100 bg-white shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1)] ${
              activeDropdown === dropdown.key
                ? "block animate-[megaFadeIn_0.15s_ease-out]"
                : "hidden"
            }`}
            onMouseEnter={() => handleDropdownEnter(dropdown.key)}
            onMouseLeave={handleDropdownLeave}
          >
            <div className="mx-auto max-w-7xl px-6 py-8">
              <BentoMenuPanel items={dropdown.items} dropdownKey={dropdown.key} getItemHref={getItemHref} />
            </div>
          </div>
        ))}
        {/* Pricing dropdown panel */}
        <div
          id="mega-panel-pricing"
          role="menu"
          className={`absolute left-0 right-0 top-full border-t border-gray-100 bg-white shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1)] ${
            activeDropdown === "pricing"
              ? "block animate-[megaFadeIn_0.15s_ease-out]"
              : "hidden"
          }`}
          onMouseEnter={() => handleDropdownEnter("pricing")}
          onMouseLeave={handleDropdownLeave}
        >
          <div className="mx-auto max-w-7xl px-6 py-8">
            <div className="grid grid-cols-2 gap-4 max-w-xl">
              <Link
                href="/portal/request-quote"
                className="group flex gap-4 rounded-xl border border-gray-100 bg-gray-50/50 p-6 transition-all hover:border-blue-100 hover:bg-blue-50/30 hover:shadow-sm"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-cd-blue/10">
                  <LuGlobe className="h-5 w-5 text-cd-blue" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900">GovClerk Portal</p>
                    <LuArrowRight className="h-3.5 w-3.5 -translate-x-1 text-gray-400 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-gray-500">
                    Public portal, live streaming &amp; transparency
                  </p>
                </div>
              </Link>
              <Link
                href="/pricing"
                className="group flex gap-4 rounded-xl border border-gray-100 bg-gray-50/50 p-6 transition-all hover:border-blue-100 hover:bg-blue-50/30 hover:shadow-sm"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-cd-blue/10">
                  <LuFileText className="h-5 w-5 text-cd-blue" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900">GovClerkMinutes</p>
                    <LuArrowRight className="h-3.5 w-3.5 -translate-x-1 text-gray-400 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-gray-500">
                    AI minutes generation &amp; agenda management
                  </p>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile fullscreen menu */}
      <div
        className={`fixed left-0 right-0 bottom-0 z-[200] flex w-screen flex-col overflow-auto bg-white transition-opacity duration-200 ${
          isMenuOpen ? "flex" : "hidden"
        } ${isClosing ? "opacity-0" : "opacity-100"}`}
        style={{ top: `${navTopOffset}px` }}
      >
        {/* Mobile header */}
        <div className="flex h-20 items-center justify-between border-b border-gray-100 px-6">
          <Link href="/" className="flex items-center" onClick={handleClose}>
            <Image
              src="/govclerk-logo.svg"
              alt="GovClerk"
              width={350}
              height={100}
              className="w-[180px] h-auto"
            />
          </Link>
          <button
            type="button"
            aria-label="Close menu"
            onClick={handleClose}
            className="rounded-md p-2 text-gray-700 transition-colors hover:bg-gray-100"
          >
            <IoClose className="h-5 w-5" />
          </button>
        </div>

        {/* Mobile menu items */}
        <div className="flex flex-1 flex-col px-6 pt-4">
          {navDropdowns.map((dropdown) => (
            <div key={dropdown.key}>
              <button
                type="button"
                onClick={() =>
                  setMobileExpanded(mobileExpanded === dropdown.key ? null : dropdown.key)
                }
                aria-expanded={mobileExpanded === dropdown.key}
                aria-controls={`mobile-panel-${dropdown.key}`}
                className="flex w-full items-center justify-between py-5 text-lg font-medium text-gray-900 transition-colors hover:text-blue-600"
              >
                {dropdown.label}
                <LuChevronDown
                  className={`h-5 w-5 transition-transform duration-200 ${
                    mobileExpanded === dropdown.key ? "rotate-180" : ""
                  }`}
                />
              </button>

              {mobileExpanded === dropdown.key && (
                <div id={`mobile-panel-${dropdown.key}`} className="flex flex-col gap-0 pb-4 pl-2">
                  {dropdown.items.map((item) => {
                    const IconComponent = item.icon;
                    return (
                      <Link
                        key={item.title}
                        href={getItemHref(item)}
                        onClick={handleClose}
                        className="flex items-center gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-gray-50"
                      >
                        <IconComponent className="h-5 w-5 text-cd-blue" />
                        <div>
                          <p className="text-sm font-medium text-gray-800">{item.title}</p>
                          <p className="text-xs text-gray-500">{item.description}</p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          ))}

          {/* Pricing mobile dropdown - shown for all users */}
          <div>
            <button
              type="button"
              onClick={() =>
                setMobileExpanded(mobileExpanded === "pricing" ? null : "pricing")
              }
              aria-expanded={mobileExpanded === "pricing"}
              aria-controls="mobile-panel-pricing"
              className="flex w-full items-center justify-between py-5 text-lg font-medium text-gray-900 transition-colors hover:text-blue-600"
            >
              Pricing
              <LuChevronDown
                className={`h-5 w-5 transition-transform duration-200 ${
                  mobileExpanded === "pricing" ? "rotate-180" : ""
                }`}
              />
            </button>
            {mobileExpanded === "pricing" && (
              <div id="mobile-panel-pricing" className="flex flex-col gap-0 pb-4 pl-2">
                <Link
                  href="/portal/request-quote"
                  onClick={handleClose}
                  className="flex items-center gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-gray-50"
                >
                  <LuGlobe className="h-5 w-5 text-cd-blue" />
                  <div>
                    <p className="text-sm font-medium text-gray-800">GovClerk Portal</p>
                    <p className="text-xs text-gray-500">Public portal, live streaming &amp; transparency</p>
                  </div>
                </Link>
                <Link
                  href="/pricing"
                  onClick={handleClose}
                  className="flex items-center gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-gray-50"
                >
                  <LuFileText className="h-5 w-5 text-cd-blue" />
                  <div>
                    <p className="text-sm font-medium text-gray-800">GovClerkMinutes</p>
                    <p className="text-xs text-gray-500">AI minutes generation &amp; agenda management</p>
                  </div>
                </Link>
              </div>
            )}
          </div>

          {isLoaded && !userId && (
            <div className="mt-4 flex flex-col gap-0 border-t border-gray-100 pt-4">
              <a
                href="https://govclerkpartners.org"
                className="flex items-center gap-2 py-4 text-lg font-medium text-green-700 transition-colors hover:text-green-800"
                onClick={handleClose}
              >
                <LuGlobe className="h-5 w-5" />
                Public Portal
              </a>
              <Link
                href="/sign-in"
                className="py-4 text-lg font-medium text-gray-900 transition-colors hover:text-blue-600"
                onClick={handleClose}
              >
                Sign In
              </Link>
              <a
                href="https://calendly.com/cliff-govclerkminutes/30min"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 rounded-md bg-cd-blue py-3 text-center text-base font-medium text-white transition-colors hover:bg-cd-blue-dark"
                onClick={handleClose}
              >
                Book a Demo
              </a>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
