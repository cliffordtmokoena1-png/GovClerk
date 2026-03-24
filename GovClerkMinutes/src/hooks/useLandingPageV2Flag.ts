import { useEffect, useState } from "react";
import { checkColdFeatureFlagFromCookie } from "@/featureFlags/coldFeatureFlags";

export function useLandingPageV2Flag() {
  const [showV2, setShowV2] = useState(false);

  useEffect(() => {
    if (typeof document !== "undefined") {
      const cookies = Object.fromEntries(
        document.cookie.split(";").map((cookie) => {
          const [name, value] = cookie.trim().split("=");
          return [name, value ? decodeURIComponent(value) : ""];
        })
      );

      const flagResult = checkColdFeatureFlagFromCookie(cookies, "landing_page_v2");
      if (flagResult.isSet && flagResult.value) {
        setShowV2(true);
      }
    }
  }, []);

  return showV2;
}
