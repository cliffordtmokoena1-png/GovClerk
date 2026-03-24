import { useEffect, useState } from "react";

type NetworkStatus = {
  isOnline: boolean;
  effectiveType?: string; // '4g' | '3g' | '2g' | 'slow-2g'
  downlink?: number; // Mbps
  rtt?: number; // ms
  saveData?: boolean;
};

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>(() => ({
    isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
  }));

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const update = () => {
      const conn =
        (navigator as any).connection ||
        (navigator as any).mozConnection ||
        (navigator as any).webkitConnection;

      setStatus({
        isOnline: navigator.onLine,
        effectiveType: conn?.effectiveType,
        downlink: conn?.downlink,
        rtt: conn?.rtt,
        saveData: conn?.saveData,
      });
    };

    // Initial read
    update();

    // Listen for changes
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    const conn =
      (navigator as any).connection ||
      (navigator as any).mozConnection ||
      (navigator as any).webkitConnection;
    conn?.addEventListener("change", update);

    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      conn?.removeEventListener("change", update);
    };
  }, []);

  return status;
}
