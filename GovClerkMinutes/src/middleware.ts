import { getClerkKeys } from "./utils/clerk";
import { isProd } from "./utils/dev";
import { withMiddlewareErrorHandling } from "./error/withErrorReporting";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import type { ClerkMiddlewareAuth } from "@clerk/nextjs/server";
import { NextFetchEvent, NextRequest, NextResponse } from "next/server";
import {
  handleLandingPagePersonalization,
  isLandingPageRequest,
} from "./utils/landing/landingPageMiddleware";
import { getSiteFromHost, isGovClerk, isGovClerkMinutes, isGovClerkPartners, Site, SITE_HEADER } from "./utils/site";

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/profile(.*)",
  "/checkout(.*)",
  "/recordings(.*)",
  "/templates(.*)",
]);
const isAdminRoute = createRouteMatcher(["/admin(.*)"]);
const isOrgRoute = createRouteMatcher(["/a/(.*)", "/org/signup(.*)"]);

const ORG_ROUTE_PREFIXES = [
  "/dashboard",
  "/meetings",
  "/boards",
  "/broadcast",
  "/organization",
  "/account",
];

const CD_LANDING_PREFIXES = [
  "/product",
  "/solutions",
  "/blog",
  "/docs",
  "/help",
  "/case-studies",
  "/about",
  "/contact",
  "/careers",
  "/partners",
  "/acceptable-use",
  "/overview",
];

const PORTAL_ROUTE_PREFIXES = [
  "/pricing",
  "/request-quote",
];

function getOrgRewritePath(pathname: string): string | null {
  for (const prefix of ORG_ROUTE_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) {
      return `/a${pathname}`;
    }
  }
  return null;
}

function getCdLandingRewritePath(pathname: string): string | null {
  for (const prefix of CD_LANDING_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) {
      return `/cd${pathname}`;
    }
  }
  return null;
}

function getPortalRewritePath(pathname: string): string | null {
  // Already under /portal — pass through
  if (pathname === "/portal" || pathname.startsWith("/portal/")) return null;
  // Root → portal landing
  if (pathname === "/") return "/portal";
  // Known portal route prefixes
  for (const prefix of PORTAL_ROUTE_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) {
      return `/portal${pathname}`;
    }
  }
  // Dynamic slug routes: anything that isn't an API/auth/static path
  if (
    !pathname.startsWith("/api/") &&
    !pathname.startsWith("/sign-in") &&
    !pathname.startsWith("/sign-up") &&
    !pathname.startsWith("/_next") &&
    !pathname.startsWith("/dashboard")
  ) {
    return `/portal${pathname}`;
  }
  return null;
}

function withSiteHeader(req: NextRequest, site: string, response?: NextResponse): NextResponse {
  const res = response || NextResponse.next();
  // Set the header on the response going to the browser
  res.headers.set(SITE_HEADER, site);
  // Set the header on the request so the app knows which site it is
  req.headers.set(SITE_HEADER, site);
  return res;
}

function buildClerkHandler(site: Site) {
  return async (auth: ClerkMiddlewareAuth, req: NextRequest) => {
    const { pathname } = req.nextUrl;

    if (isGovClerkMinutes(site) && isOrgRoute(req)) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    if (isGovClerkPartners(site)) {
      // Minutes-specific routes → redirect to govclerkminutes.com
      if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
        return NextResponse.redirect(new URL("https://govclerkminutes.com/dashboard"));
      }

      // Sign-in/sign-up — pass through (auth works on both domains)
      if (pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up")) {
        return withSiteHeader(req, site);
      }

      // API routes — pass through
      if (pathname.startsWith("/api/")) {
        return withSiteHeader(req, site);
      }

      // Rewrite to portal routes
      const portalRewritePath = getPortalRewritePath(pathname);
      if (portalRewritePath) {
        return withSiteHeader(req, site, NextResponse.rewrite(new URL(portalRewritePath, req.url)));
      }

      return withSiteHeader(req, site);
    }

    if (isGovClerk(site)) {
      if (pathname === "/") {
        const { userId } = await auth();

        if (!userId) {
          return withSiteHeader(req, site, NextResponse.rewrite(new URL("/cd", req.url)));
        }

        return withSiteHeader(req, site, NextResponse.rewrite(new URL("/a/dashboard", req.url)));
      }

      const orgRewritePath = getOrgRewritePath(pathname);
      if (orgRewritePath) {
        return withSiteHeader(req, site, NextResponse.rewrite(new URL(orgRewritePath, req.url)));
      }

      const cdLandingPath = getCdLandingRewritePath(pathname);
      if (cdLandingPath) {
        return withSiteHeader(req, site, NextResponse.rewrite(new URL(cdLandingPath, req.url)));
      }
    }

    if (isLandingPageRequest(req)) {
      return withSiteHeader(req, site, handleLandingPagePersonalization(req));
    }

    if (isAdminRoute(req)) {
      const { sessionClaims } = await auth();

      if (sessionClaims?.metadata?.role !== "admin") {
        return NextResponse.redirect(new URL("/sign-in", req.url));
      }

      return withSiteHeader(req, site);
    }

    if (isProtectedRoute(req)) {
      await auth.protect();
    }

    return withSiteHeader(req, site);
  };
}

function buildClerkMiddleware(site: Site) {
  try {
    const keys = getClerkKeys(site);
    if (!keys.publishableKey || !keys.secretKey) {
      console.error(`[middleware] Clerk keys missing for "${site}", skipping auth middleware.`);
      return null;
    }
    return clerkMiddleware(buildClerkHandler(site), {
      // FIX: Only debug if NOT in production
      debug: !isProd(),
      clockSkewInMs: 10 * 60 * 1000,
      publishableKey: keys.publishableKey,
      secretKey: keys.secretKey,
    });
  } catch (error) {
    console.error(`[middleware] Failed to build Clerk middleware for "${site}":`, error);
    return null;
  }
}

const mgMiddleware = buildClerkMiddleware("GovClerkMinutes");
const cdMiddleware = buildClerkMiddleware("GovClerk");
const partnersMiddleware = buildClerkMiddleware("GovClerkPartners");

const middleware = async (req: NextRequest, event: NextFetchEvent) => {
  const site = getSiteFromHost(req.headers.get("host"));

  let activeMiddleware;
  if (isGovClerkPartners(site)) {
    activeMiddleware = partnersMiddleware;
  } else if (isGovClerk(site)) {
    activeMiddleware = cdMiddleware;
  } else {
    activeMiddleware = mgMiddleware;
  }

  if (!activeMiddleware) {
    // No Clerk middleware available — pass through the request
    return withSiteHeader(req, site);
  }

  try {
    return await activeMiddleware(req, event);
  } catch (error) {
    console.error("[middleware] Clerk middleware error, falling through:", error);
    return withSiteHeader(req, site);
  }
};

export default withMiddlewareErrorHandling(middleware);

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
