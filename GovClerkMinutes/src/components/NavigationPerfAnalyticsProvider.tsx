import { createContext, useContext, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { safeCapture } from "@/utils/safePosthog";

export type NavigationPerfAnalytics = {
  startNavMeasurement: (data: Omit<Analytic, "src" | "start">) => void;
};

const NavigationPerfAnalyticsContext = createContext<NavigationPerfAnalytics>({
  startNavMeasurement: () => {},
});

type Props = {
  children: React.ReactNode;
};

type Analytic = {
  event: `nav_perf_${string}`;
  src: string;
  dest: string;
  start: number;
};

type PendingAnalytics = {
  analytics: Analytic[];
};

export function NavigationPerfAnalyticsProvider({ children }: Props) {
  const pendingAnalytics = useRef<PendingAnalytics>({
    analytics: [],
  });
  const router = useRouter();

  const startNavMeasurement = (data: Omit<Analytic, "src" | "start">) => {
    pendingAnalytics.current.analytics.push({
      ...data,
      src: router.asPath,
      start: Math.floor(performance.now()),
    });
  };

  useEffect(() => {
    const handleRouteChangeComplete = (path: string) => {
      const end = Math.floor(performance.now());

      const remaining = [];

      for (const { event, src, dest, start } of pendingAnalytics.current.analytics) {
        if (dest === path) {
          safeCapture(event, {
            src,
            dest,
            duration: Math.min(end - start, 60 * 1000), // Cap at 1 minute.
          });
        } else {
          remaining.push({ event, src, dest, start });
        }
      }

      pendingAnalytics.current.analytics = remaining;
    };

    router.events.on("routeChangeComplete", handleRouteChangeComplete);

    return () => {
      router.events.off("routeChangeComplete", handleRouteChangeComplete);
    };
  }, [router]);

  return (
    <NavigationPerfAnalyticsContext.Provider value={{ startNavMeasurement }}>
      {children}
    </NavigationPerfAnalyticsContext.Provider>
  );
}

export const useNavigationPerfAnalytics = () => useContext(NavigationPerfAnalyticsContext);
