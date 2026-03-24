import { useDeviceId } from "@/hooks/useDeviceId";
import { VAPID_PUBLIC_KEY_B64URL } from "@/push/consts";
import { useEffect } from "react";

function base64UrlToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

type Props = {
  enabled?: boolean;
};

export default function AdminPushSubscription({ enabled = true }: Props) {
  const deviceId = useDeviceId();

  useEffect(() => {
    if (!enabled) {
      return;
    }
    if (typeof window === "undefined") {
      return;
    }
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      return;
    }
    if (!deviceId) {
      return;
    }

    const run = async () => {
      try {
        // Ensure SW ready
        const registration = await navigator.serviceWorker.ready;
        const LOCAL_KEY = "gc_last_vapid_pub";
        // Fetch current key from server to avoid build-time stale embedding
        const currentKey = VAPID_PUBLIC_KEY_B64URL;
        const lastKey = (() => {
          try {
            return localStorage.getItem(LOCAL_KEY) || null;
          } catch {
            return null;
          }
        })();
        const keyRotated = lastKey !== null && lastKey !== currentKey;

        // If key rotated, we need to (a) unsubscribe old sub (b) create new with new key.
        let existingSub = await registration.pushManager.getSubscription();

        if (keyRotated && existingSub) {
          try {
            // Best-effort server cleanup (optional).
            fetch("/api/admin/push/unsubscribe", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ deviceId }),
            }).catch(() => {});
            await existingSub.unsubscribe();
          } catch (e) {
            // Ignore
          }
          existingSub = null;
        }

        // Ask for permission (again if needed) – permissions generally persist, but re-check after unsubscribe
        let permission = Notification.permission;
        if (permission === "default") {
          permission = await Notification.requestPermission();
        }
        if (permission !== "granted") {
          return;
        }

        // Create new subscription if needed
        let sub = existingSub;
        if (!sub) {
          sub = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: base64UrlToUint8Array(currentKey) as any,
          });
        }

        // Persist the current key locally so we can detect rotation later
        try {
          localStorage.setItem(LOCAL_KEY, currentKey);
        } catch {}

        await fetch("/api/admin/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceId, sub }),
        });
      } catch (e) {
        console.warn("Admin push subscribe failed", e);
      }
    };

    run();
  }, [enabled, deviceId]);

  return null;
}
