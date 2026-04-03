import React, { useState, useEffect, useMemo } from "react";
import { useUser, useSession } from "@clerk/nextjs";
import Link from "next/link";
import { ORG_SIDEBAR_ITEMS } from "../constants";
import { useWebSocket } from "@/admin/hooks/useWebSocket";
import { SophonWebSocket } from "@/sophon/types";
import { getSophonWsUrl } from "@/sophon/config";
import StreamingHoursBar from "../StreamingHoursBar";

function DashboardContent() {
  const { user } = useUser();
  const { session, isLoaded } = useSession();
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [streamKey, setStreamKey] = useState<string>();

  const isAdmin = isLoaded && session?.user?.publicMetadata?.role === "admin";

  const { subscribe } = useWebSocket<SophonWebSocket.IncomingMessage>(getSophonWsUrl("/ws"));

  useEffect(() => {
    const unsubscribe = subscribe({
      onMessage: (msg: SophonWebSocket.IncomingMessage) => {
        switch (msg.kind) {
          case "stream_started": {
            console.info("[DashboardContent] Stream started:", msg.streamKey);
            setStreamKey(msg.streamKey);
            break;
          }
          case "stream_ended": {
            console.info("[DashboardContent] Stream ended:", msg.streamKey);
            setStreamKey(undefined);
            break;
          }
        }
      },
      onConnect: () => {
        console.info("[DashboardContent] WebSocket connected");
      },
    });

    return () => {
      unsubscribe();
    };
  }, [subscribe]);

  const quickAccessItems = useMemo(() => {
    return ORG_SIDEBAR_ITEMS.filter(
      (item) => item.id !== "dashboard" && (!item.adminOnly || isAdmin)
    );
  }, [isAdmin]);

  useEffect(() => {
    // Set initial time on mount (client-side only)
    setCurrentTime(new Date());

    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString([], {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const displayName = user?.firstName || user?.username || "there";

  return (
    <div className="h-full w-full overflow-auto p-6 md:p-10">
      <div className="max-w-5xl mx-auto">
        <div className="mb-10 md:mb-14">
          <h1 className="text-3xl md:text-3xl font-light text-foreground mb-2">
            Hi, {displayName}!
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground">
            {currentTime ? (
              <>
                It&apos;s currently {formatTime(currentTime)}, {formatDate(currentTime)}
              </>
            ) : (
              <>&nbsp;</>
            )}
          </p>
        </div>

        <div>
          <StreamingHoursBar />
          <h2 className="text-lg md:text-lg font-semibold text-foreground mb-6">Quick Access</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {quickAccessItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`
                    flex flex-col items-start justify-center p-6 rounded-xl
                    bg-card border border-border
                    hover:shadow-md hover:border-muted-foreground/30 hover:bg-muted
                    transition-all duration-200 cursor-pointer
                    ${item.isPlaceholder ? "opacity-50 pointer-events-none" : ""}
                  `}
                >
                  <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-sm font-medium text-muted-foreground text-center">
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>

        {streamKey && (
          <div className="mt-10 p-6 bg-yellow-50 border-l-4 border-yellow-400">
            <h3 className="text-md font-semibold text-yellow-800 mb-2">Live Stream Active</h3>
            <p className="text-yellow-700">
              A live stream is currently active with stream key:{" "}
              <span className="font-mono">{streamKey}</span>
            </p>
            <a
              href={`https://GovClerkMinutes.com/live/${streamKey}`}
              target="_blank"
              rel="noreferrer"
              className="text-yellow-800 underline"
            >
              Click here to watch
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export default DashboardContent;
