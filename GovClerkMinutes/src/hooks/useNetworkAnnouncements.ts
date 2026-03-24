import { useEffect, useRef } from "react";
import { useNetworkStatus } from "./useNetworkStatus";
import { useAnnouncements } from "@/contexts/AnnouncementContext";
import { SLOW_NETWORK_TEXT } from "@/types/announcement";

const SLOW_NETWORK_THRESHOLD_MBPS = 2;
const ANNOUNCEMENT_DEBOUNCE_MS = 5000;

export function useNetworkAnnouncements() {
  const net = useNetworkStatus();
  const { addAnnouncement, dismissAnnouncement } = useAnnouncements();
  const slowNetworkAnnouncementIdRef = useRef<string | null>(null);
  const lastAnnouncementTimeRef = useRef<number>(0);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const now = Date.now();
    const timeSinceLastAnnouncement = now - lastAnnouncementTimeRef.current;

    if (timeSinceLastAnnouncement < ANNOUNCEMENT_DEBOUNCE_MS) {
      return;
    }

    const isSlowNetwork = net.downlink != null && net.downlink < SLOW_NETWORK_THRESHOLD_MBPS;

    if (isSlowNetwork && slowNetworkAnnouncementIdRef.current == null) {
      const id = addAnnouncement({
        text: SLOW_NETWORK_TEXT,
        variant: "slow-network",
        dismissible: true,
      });
      slowNetworkAnnouncementIdRef.current = id;
      lastAnnouncementTimeRef.current = now;
    } else if (!isSlowNetwork && slowNetworkAnnouncementIdRef.current != null) {
      dismissAnnouncement(slowNetworkAnnouncementIdRef.current);
      slowNetworkAnnouncementIdRef.current = null;
    }
  }, [net.downlink, addAnnouncement, dismissAnnouncement]);

  return net;
}
