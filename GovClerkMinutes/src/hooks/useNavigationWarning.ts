import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export default function useNavigationWarningIf(shouldWarn: boolean) {
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    const handleRouteChange = (url: string, options: any) => {
      // setIsNavigating(true);
      // if (shouldWarn) {
      //   e.preventDefault();
      // }
    };

    router.events.on("routeChangeStart", handleRouteChange);

    return () => {
      router.events.off("routeChangeStart", handleRouteChange);
    };
  }, [router.events]);

  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      // setIsNavigating(true);
      if (shouldWarn) {
        e.preventDefault();
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [shouldWarn]);

  return isNavigating;
}
