import { useRouter } from "next/router";
import { PostHogProvider } from "posthog-js/react";
import posthog from "posthog-js";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import useSWR from "swr";
import Cookies from "js-cookie";
import { COLD_FEATURE_FLAG_COOKIE_NAME } from "@/featureFlags/coldFeatureFlags";

type PosthogContextProps = {
  setFreshUserId: (userId?: string) => void;
  setFreshEmail: (email?: string) => void;
};

const PosthogContext = createContext<PosthogContextProps>({
  setFreshUserId: () => {},
  setFreshEmail: () => {},
});

export const usePosthogProvider = () => useContext(PosthogContext);

export default function CustomPosthogProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const oldUrlRef = useRef("");
  const { userId: loggedInUserId, getToken } = useAuth();
  const [freshUserId, setFreshUserId] = useState<string>();
  const [freshEmail, setFreshEmail] = useState<string>();

  // Default to the userId reported by clerk if we are logged in.  Otherwise we
  // may have a "fresh" userId which means we signed up via email form, and have
  // not yet logged in on the client.  For example on the FB in-app browser.
  const userId = loggedInUserId ?? freshUserId;

  const transcriptId = router.asPath.match(/.*\/dashboard\/(\d+).*/)?.[1] || undefined;

  const { data } = useSWR<{ email?: string }>(
    userId == null ? null : ["/api/get-email", userId],
    async (_: string) => {
      await getToken();
      return await fetch("/api/get-email").then((r) => r.json());
    }
  );

  const email = data?.email ?? freshEmail;

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[PostHog] NEXT_PUBLIC_POSTHOG_KEY not set - analytics disabled");
      }
      return;
    }

    try {
      posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
        // Enable debug mode in development
        loaded: (posthog) => {
          if (process.env.NODE_ENV === "development") {
            posthog.debug();
          }
        },
        person_profiles: "always",
      });
    } catch (error) {
      console.error("[PostHog] Failed to initialize:", error);
    }

    const handleRouteChange = () => {
      posthog?.capture("$pageview");
    };

    const handleRouteChangeStart = () => {
      posthog?.capture("$pageleave", {
        $current_url: oldUrlRef.current,
      });
    };

    router.events.on("routeChangeComplete", handleRouteChange);
    router.events.on("routeChangeStart", handleRouteChangeStart);

    return () => {
      router.events.off("routeChangeComplete", handleRouteChange);
      router.events.off("routeChangeStart", handleRouteChangeStart);
    };
  }, [router.events]);

  useEffect(() => {
    posthog.identify(userId ?? undefined, {
      ...JSON.parse(Cookies.get(COLD_FEATURE_FLAG_COOKIE_NAME) ?? "{}"),
    });
  }, [userId]);

  useEffect(() => {
    if (userId == null || email == null) {
      return;
    }

    const utmParams = JSON.parse(Cookies.get("gc_utm_params") ?? "{}");
    const utmProperties = {
      $initial_utm_source: utmParams?.utm_source,
      $initial_utm_medium: utmParams?.utm_medium,
      $initial_utm_campaign: utmParams?.utm_campaign,
      $initial_utm_term: utmParams?.utm_term,
      $initial_utm_content: utmParams?.utm_content,
    };

    posthog.identify(userId, { email, ...utmProperties });

    return () => posthog.reset();
  }, [email, userId]);

  useEffect(() => {
    if (transcriptId == null) {
      posthog.resetGroups();
    } else {
      posthog.group("transcript", String(transcriptId));
    }

    return () => {
      posthog.resetGroups();
    };
  }, [transcriptId]);

  return (
    <PosthogContext.Provider value={{ setFreshUserId, setFreshEmail }}>
      <PostHogProvider client={posthog}>{children}</PostHogProvider>
    </PosthogContext.Provider>
  );
}
