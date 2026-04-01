import "@/styles/globals.css";
import "@/styles/portal-print.css";
import type { AppContext, AppProps } from "next/app";
import App from "next/app";
import { ChakraProvider } from "@chakra-ui/react";
import theme from "@/theme";

import "@fontsource-variable/plus-jakarta-sans";

import "react-h5-audio-player/lib/styles.css";
import { UploadUriProvider } from "@/components/UploadUriProvider";
import { RecordingStateProvider } from "@/contexts/RecordingStateContext";
import { AnnouncementProvider } from "@/contexts/AnnouncementContext";
import Script from "next/script";

import { useRouter } from "next/router";
import { useEffect, useState } from "react";

import Cookies from "js-cookie";
import { getClerkKeys } from "@/utils/clerk";
import { getSiteFromWindow } from "@/utils/site";
import type { Site } from "@/utils/site";
import { SITE_HEADER } from "@/utils/site";
import { NavigationPerfAnalyticsProvider } from "@/components/NavigationPerfAnalyticsProvider";
import { ClerkProvider } from "@clerk/nextjs";
import WhatsAppFloatingButton from "@/components/WhatsAppFloatingButton";
import CustomPosthogProvider from "@/components/CustomPosthogProvider";
import { WebSocketProvider } from "@/admin/hooks/useWebSocket";
import { SWRConfig } from "swr";
import { OrgContextProvider } from "@/contexts/OrgContext";
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans-inter",
});

type MyAppProps = AppProps & {
  site: Site;
};

function MyApp({ Component, pageProps, site: ssrSite }: MyAppProps) {
  const router = useRouter();
  const discount = router.query.discount;

  const [site] = useState<Site>(() => ssrSite ?? getSiteFromWindow());

  useEffect(() => {
    if (discount === "valuedcustomer") {
      Cookies.set("mgdiscount", "true", { expires: 30 });
    }

    const fbclid = router.query.fbclid;
    if (fbclid && Cookies.get("_fbc") === undefined) {
      const timestamp = Date.now();
      const fbcValue = `fb.1.${timestamp}.${fbclid}`;
      Cookies.set("_fbc", fbcValue, { expires: 90 });
    }

    const sendMetaConversionsViewContent = (): Promise<string> => {
      return fetch("/api/meta-conversions-api-view-content")
        .then((res) => res.json())
        .then((data) => data?.fbc);
    };

    sendMetaConversionsViewContent().then((fbc) => {
      if (fbc && Cookies.get("_fbc") === undefined) {
        Cookies.set("_fbc", fbc, { expires: 90 });
      }
    });

    const handleRouteChange = () => {
      sendMetaConversionsViewContent().then((fbc) => {
        if (fbc && Cookies.get("_fbc") === undefined) {
          Cookies.set("_fbc", fbc, { expires: 90 });
        }
      });
    };
    router.events.on("routeChangeComplete", handleRouteChange);

    return () => {
      router.events.off("routeChangeComplete", handleRouteChange);
    };
  }, [discount, router.events, router.query.fbclid]);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/service-worker.js?v=2", { scope: "" })
        .then((registration) => registration.update())
        .catch((err) => console.error("Service Worker failed: ", err));
    }
  }, []);

  const clerkPublishableKey =
    getClerkKeys(site)?.publishableKey || process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  const appContent = (
    <OrgContextProvider>
      <CustomPosthogProvider>
        <SWRConfig
          value={{
            dedupingInterval: 2000,
            revalidateOnFocus: false,
            revalidateOnReconnect: false,
            shouldRetryOnError: false,
          }}
        >
          <ChakraProvider theme={theme}>
            <NavigationPerfAnalyticsProvider>
              <AnnouncementProvider>
                <UploadUriProvider>
                  <RecordingStateProvider>
                    <WebSocketProvider debug>
                      <Component {...pageProps} />
                    </WebSocketProvider>
                  </RecordingStateProvider>
                  <Script id="fb-pixel" strategy="afterInteractive">
                    {`!function(f,b,e,v,n,t,s)
                    {if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
                    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
                    n.queue=[];t=b.createElement(e);t.async=!0;
                    t.src=v;s=b.getElementsByTagName(e)[0];
                    s.parentNode.insertBefore(t,s)}(window, document,'script','https://connect.facebook.net/en_US/fbevents.js');
                    fbq('init', '${process.env.NEXT_PUBLIC_FB_PIXEL_ID}');
                    fbq('track', 'PageView');`}
                  </Script>
                </UploadUriProvider>
              </AnnouncementProvider>
            </NavigationPerfAnalyticsProvider>
            <WhatsAppFloatingButton />
          </ChakraProvider>
        </SWRConfig>
      </CustomPosthogProvider>
    </OrgContextProvider>
  );

  return (
    <div className={inter.variable}>
      {clerkPublishableKey ? (
        <ClerkProvider key={site} {...pageProps} publishableKey={clerkPublishableKey}>
          {appContent}
        </ClerkProvider>
      ) : (
        appContent
      )}
    </div>
  );
}

export default MyApp;
