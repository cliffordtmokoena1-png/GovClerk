import { NextRequest, NextResponse } from "next/server";
import { DISCOUNT_COOKIE_NAME, getDiscountCodeId } from "@/cookies/discounts";
import { getCountry } from "@/pages/api/get-country";
import isFbIg from "@/utils/isFbIg";
import { isValidSlug } from "@/utils/landing/landingUtils";
import {
  checkColdFeatureFlagFromCookie,
  getCookieValueAfterSettingFlag,
  COLD_FEATURE_FLAG_COOKIE_NAME,
} from "@/featureFlags/coldFeatureFlags";

/**
 * Handle landing page personalization in middleware
 * Sets cookies for discount codes and adds headers for country/user agent detection
 */
export function handleLandingPagePersonalization(req: NextRequest): NextResponse {
  const response = NextResponse.next();

  const discountCode = req.nextUrl.searchParams.get("discount_code");
  if (discountCode && getDiscountCodeId(discountCode) != null) {
    response.cookies.set(DISCOUNT_COOKIE_NAME, discountCode, {
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      secure: process.env.NODE_ENV === "production",
    });
  }

  const country = getCountry((h) => req.headers.get(h) as any);
  if (country) {
    response.headers.set("x-user-country", country);
    response.cookies.set("mg-country", country, {
      path: "/",
      maxAge: 60 * 60 * 24, // 24 hours
      secure: process.env.NODE_ENV === "production",
    });
  }

  const userAgent = req.headers.get("user-agent");
  const fromFbAd = isFbIg(userAgent ?? "");
  response.headers.set("x-from-fb-ad", fromFbAd.toString());
  response.cookies.set("mg-from-fb-ad", fromFbAd.toString(), {
    path: "/",
    maxAge: 60 * 60 * 24, // 24 hours
    secure: process.env.NODE_ENV === "production",
  });

  const cookies: Record<string, string> = {};
  req.cookies.getAll().forEach((cookie) => {
    cookies[cookie.name] = cookie.value;
  });

  const flagResult = checkColdFeatureFlagFromCookie(cookies, "landing_page_v2");

  if (!flagResult.isSet) {
    const shouldShowV2 = Math.random() < 0.5;
    const cookieValue = getCookieValueAfterSettingFlag(cookies, "landing_page_v2", shouldShowV2);
    response.headers.append("Set-Cookie", cookieValue);
  }

  return response;
}

/**
 * Check if the request is for a landing page that needs personalization
 */
export function isLandingPageRequest(req: NextRequest): boolean {
  const { pathname } = req.nextUrl;

  if (pathname === "/") {
    return true;
  }

  // Dynamic landing pages - only match valid slugs from our mapping
  const pathSegments = pathname.split("/").filter(Boolean);
  if (pathSegments.length === 1) {
    const slug = pathSegments[0];
    return isValidSlug(slug);
  }

  return false;
}
