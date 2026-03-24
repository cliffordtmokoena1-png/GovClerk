import { useEffect, useRef } from "react";
import { useNetworkStatus } from "./useNetworkStatus";
import { safeCapture } from "@/utils/safePosthog";

type Options = {
  sampleMs?: number; // default 30s
  flushMs?: number; // default 15m
  enabled?: boolean; // default true
  minSamplesForFlush?: number; // guard to avoid tiny windows (default 5)
  flushOnVisibility?: "ifReady" | "never"; // default "ifReady"
};

export function useNetworkAnalytics(opts: Options = {}) {
  const {
    sampleMs = 30_000,
    flushMs = 15 * 60_000,
    enabled = true,
    minSamplesForFlush = 5,
    flushOnVisibility = "ifReady",
  } = opts;

  const net = useNetworkStatus();

  // latest status cache
  const latestNetRef = useRef(net);
  useEffect(() => {
    latestNetRef.current = net;
  }, [net]);

  // stats window
  const statsRef = useRef({
    sumDownlink: 0,
    downlinkCount: 0,
    sumRtt: 0,
    rttCount: 0,
    onlineCount: 0,
    saveDataCount: 0,
    sampleCount: 0,
    effectiveTypeCounts: {} as Record<string, number>,
    windowStartTs: Date.now(),
  });

  // enforce a minimum spacing between sends
  const lastFlushAtRef = useRef<number>(0);

  // to avoid dev StrictMode double-invoke flush on the fake unmount
  const hasCommittedRef = useRef(false);

  useEffect(() => {
    hasCommittedRef.current = true;
  }, []);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      return;
    }

    const sample = () => {
      const s = latestNetRef.current;
      const stats = statsRef.current;

      stats.sampleCount += 1;
      if (s.isOnline) {
        stats.onlineCount += 1;
      }
      if (typeof s.downlink === "number") {
        stats.sumDownlink += s.downlink;
        stats.downlinkCount += 1;
      }
      if (typeof s.rtt === "number") {
        stats.sumRtt += s.rtt;
        stats.rttCount += 1;
      }
      if (s.saveData) {
        stats.saveDataCount += 1;
      }

      const et = s.effectiveType ?? "unknown";
      stats.effectiveTypeCounts[et] = (stats.effectiveTypeCounts[et] ?? 0) + 1;
    };

    const resetWindow = () => {
      statsRef.current = {
        sumDownlink: 0,
        downlinkCount: 0,
        sumRtt: 0,
        rttCount: 0,
        onlineCount: 0,
        saveDataCount: 0,
        sampleCount: 0,
        effectiveTypeCounts: {},
        windowStartTs: Date.now(),
      };
    };

    const flushIfReady = (force = false) => {
      const stats = statsRef.current;
      const now = Date.now();
      const windowMs = now - stats.windowStartTs;

      // only allow early/non-interval flushes if “ready”
      const readyByTime = windowMs >= flushMs;
      const readyBySamples = stats.sampleCount >= minSamplesForFlush;

      if (!force && !(readyByTime && readyBySamples)) {
        return;
      }

      if (stats.sampleCount === 0) {
        // nothing to send
        stats.windowStartTs = Date.now();
        return;
      }

      // also rate limit by lastFlushAt
      const sinceLast = now - (lastFlushAtRef.current || 0);
      if (!force && sinceLast < flushMs * 0.75) {
        // avoid duplicates if multiple triggers line up
        return;
      }

      const avgDownlink = stats.downlinkCount ? stats.sumDownlink / stats.downlinkCount : undefined;
      const avgRtt = stats.rttCount ? stats.sumRtt / stats.rttCount : undefined;

      let effectiveTypeMode: string | undefined;
      let modeCount = -1;
      for (const [k, v] of Object.entries(stats.effectiveTypeCounts)) {
        if (v > modeCount) {
          modeCount = v;
          effectiveTypeMode = k;
        }
      }

      safeCapture("network_stats_snapshot", {
        window_ms: windowMs,
        sample_count: stats.sampleCount,
        online_ratio: stats.sampleCount ? stats.onlineCount / stats.sampleCount : undefined,
        save_data_ratio: stats.sampleCount ? stats.saveDataCount / stats.sampleCount : undefined,
        avg_downlink_mbps: avgDownlink,
        avg_rtt_ms: avgRtt,
        effective_type_mode: effectiveTypeMode,
        effective_type_counts: stats.effectiveTypeCounts,
      });

      lastFlushAtRef.current = now;
      resetWindow();
    };

    // timers
    const sampleInterval = window.setInterval(sample, sampleMs);
    const flushInterval = window.setInterval(
      () => flushIfReady(true /* force interval */),
      flushMs
    );

    // initial sample so an immediately hidden tab still has ≥1 datum
    sample();

    // flush on visibility change, but only if “ready”
    const handleVisibility = () => {
      if (flushOnVisibility === "never") {
        return;
      }
      if (document.visibilityState === "hidden") {
        flushIfReady(false /* not forced: must be ready */);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    // flush on pagehide (tab/window close or bfcache), but still honor readiness
    const handlePageHide = () => {
      flushIfReady(false);
    };
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      window.clearInterval(sampleInterval);
      window.clearInterval(flushInterval);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [enabled, sampleMs, flushMs, minSamplesForFlush, flushOnVisibility]);

  return net;
}
