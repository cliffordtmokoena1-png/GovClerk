"use client";
import React, { useEffect, useState, useCallback } from "react";
import { StreamHoursResponse } from "@/pages/api/org/stream-hours";
import { PORTAL_PAYSTACK_PLANS } from "@/utils/portalPaystack";
import LowHoursAlert from "./LowHoursAlert";

export default function StreamingHoursBar() {
  const [data, setData] = useState<StreamHoursResponse | null>(null);
  const [showAlert, setShowAlert] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await window.fetch("/api/org/stream-hours");
      if (!res.ok) {return;}
      const json = (await res.json()) as StreamHoursResponse;
      setData(json);
      const remaining = json.minutesAllowed - json.minutesUsed;
      if (remaining < 30 && remaining >= 0) {
        const alreadyShown = sessionStorage.getItem("lowHoursAlertShown");
        if (!alreadyShown) {
          setShowAlert(true);
          sessionStorage.setItem("lowHoursAlertShown", "1");
        }
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 60_000);
    return () => clearInterval(id);
  }, [fetchData]);

  if (!data) {return null;}

  const { minutesUsed, minutesAllowed, planTier } = data;
  const remaining = Math.max(0, minutesAllowed - minutesUsed);
  const pct = minutesAllowed > 0 ? Math.min(100, (minutesUsed / minutesAllowed) * 100) : 0;
  const remainingHours = Math.floor(remaining / 60);
  const remainingMins = remaining % 60;
  const isLow = remaining < 30;
  const isMedium = !isLow && pct >= 50;

  const barColor = isLow
    ? "bg-red-500"
    : isMedium
    ? "bg-yellow-400"
    : "bg-green-500";

  const planLabel = planTier
    ? PORTAL_PAYSTACK_PLANS[planTier].stream_hours + " hrs/month"
    : "—";

  return (
    <>
      {showAlert && (
        <LowHoursAlert
          isOpen={showAlert}
          onClose={() => setShowAlert(false)}
          remaining={remaining}
        />
      )}
      <div
        className={`rounded-xl border border-border bg-card p-4 mb-6 ${isLow ? "animate-pulse border-red-400" : ""}`}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">📡 Streaming Hours</span>
            {planTier && (
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium capitalize">
                {planTier} · {planLabel}
              </span>
            )}
          </div>
          <span className={`text-sm font-bold ${isLow ? "text-red-500" : "text-foreground"}`}>
            {remainingHours}h {remainingMins}m remaining
          </span>
        </div>
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${100 - pct}%` }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-xs text-muted-foreground">
            {Math.floor(minutesUsed / 60)}h {minutesUsed % 60}m used
          </span>
          <span className="text-xs text-muted-foreground">
            {Math.floor(minutesAllowed / 60)}h total
          </span>
        </div>
      </div>
    </>
  );
}
