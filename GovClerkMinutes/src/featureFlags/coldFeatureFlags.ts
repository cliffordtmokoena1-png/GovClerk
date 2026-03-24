import { serialize } from "cookie";

export const COLD_FEATURE_FLAG_COOKIE_NAME = "gc_cold_feature_flags";

export type ColdFeatureFlags = {
  gc_cold_new_landing_page: boolean;
  landing_page_v2: boolean;
};

export type ColdFeatureFlagResult<T extends keyof ColdFeatureFlags> =
  | {
      isSet: true;
      value: ColdFeatureFlags[T];
    }
  | {
      isSet: false;
    };

export function checkColdFeatureFlagFromCookie(
  cookies: Partial<{ [key: string]: string }>,
  flag: keyof ColdFeatureFlags
): ColdFeatureFlagResult<typeof flag> {
  const cookieVal = cookies[COLD_FEATURE_FLAG_COOKIE_NAME];
  if (cookieVal == null) {
    return { isSet: false };
  }

  const coldFeatureFlags = JSON.parse(cookieVal) as ColdFeatureFlags;
  return {
    isSet: true,
    value: coldFeatureFlags[flag],
  };
}

export function getCookieValueAfterSettingFlag(
  cookies: Partial<{ [key: string]: string }>,
  flag: keyof ColdFeatureFlags,
  value: ColdFeatureFlags[typeof flag]
): string {
  const coldFeatureFlags = {
    ...JSON.parse(cookies[COLD_FEATURE_FLAG_COOKIE_NAME] ?? "{}"),
    [flag]: value,
  };

  return serialize(COLD_FEATURE_FLAG_COOKIE_NAME, JSON.stringify(coldFeatureFlags), {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    secure: process.env.NODE_ENV === "production",
  });
}
