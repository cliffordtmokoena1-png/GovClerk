import { useCallback, useEffect, useRef, useState } from "react";

export type UseWakeLockResult = {
  isSupported: boolean;
  isActive: boolean;
  request: () => Promise<boolean>;
  release: () => void;
};

export default function useWakeLock(): UseWakeLockResult {
  const [isActive, setIsActive] = useState(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // Check if Wake Lock API is supported
  const isSupported = typeof window !== "undefined" && "wakeLock" in navigator;

  const request = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      console.warn("Wake Lock API is not supported in this browser");
      return false;
    }

    try {
      // Release any existing wake lock first
      if (wakeLockRef.current) {
        await wakeLockRef.current.release();
      }

      // Request a new wake lock
      wakeLockRef.current = await navigator.wakeLock.request("screen");
      setIsActive(true);

      // Listen for wake lock release (can happen automatically)
      wakeLockRef.current.addEventListener("release", () => {
        setIsActive(false);
        wakeLockRef.current = null;
      });

      return true;
    } catch (err) {
      console.error("Failed to acquire wake lock:", err);
      setIsActive(false);
      wakeLockRef.current = null;
      return false;
    }
  }, [isSupported]);

  const release = () => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release();
      wakeLockRef.current = null;
      setIsActive(false);
    }
  };

  useEffect(() => {
    return () => {
      release();
    };
  }, []);

  useEffect(() => {
    if (!isSupported) {
      return;
    }

    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible" && isActive && !wakeLockRef.current) {
        // Try to re-acquire wake lock when page becomes visible
        await request();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isSupported, isActive, request]);

  return {
    isSupported,
    isActive,
    request,
    release,
  };
}
