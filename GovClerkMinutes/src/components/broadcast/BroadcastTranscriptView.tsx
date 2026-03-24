import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { LuMic, LuLoader2, LuRadio } from "react-icons/lu";
import { getTranscriptWsUrl } from "@/sophon/config";
import { formatElapsedTime, formatDuration } from "@/utils/format";
import { formatSpeakerLabel } from "@/utils/speakers";
import {
  MARKER_COLORS,
  MARKER_LABELS,
  getMarkerIcon,
  type TranscriptMarkerType,
} from "@/constants/broadcast";
import type { BroadcastTranscriptSegment } from "@/types/broadcast";

type Props = {
  broadcastId: number;
  streamKey: string;
  status: "setup" | "live" | "paused" | "ended";
  embedded?: boolean;
  onSeek?: (timestamp: number) => void;
  orgId: string;
};

type MarkerType = TranscriptMarkerType;

type TranscriptEntry = {
  id: string;
  speaker: string | null;
  text: string;
  timestamp: number;
  markerType?: MarkerType;
  label?: string;
  segmentIndex?: number;
  agendaItemId?: number;
  motionId?: number;
  startTimeSeconds?: number;
};

type UncommittedSegment = {
  id: string;
  text: string;
  receivedAt: number;
};

function formatTimestamp(timestamp: number, broadcastStartedAt?: number): string {
  return formatElapsedTime(timestamp, broadcastStartedAt);
}

export function BroadcastTranscriptView({
  broadcastId,
  streamKey,
  status,
  embedded,
  onSeek,
  orgId,
}: Readonly<Props>) {
  const [entries, setEntries] = useState<TranscriptEntry[]>([]);
  const [uncommittedSegments, setUncommittedSegments] = useState<UncommittedSegment[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isAtLive, setIsAtLive] = useState(true);
  const [isLoadingSegments, setIsLoadingSegments] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const broadcastStartTimeRef = useRef<number | null>(null);
  const transcriptionStartSecondsRef = useRef<number | null>(null);
  const sessionStartedAtRef = useRef<number | null>(null);
  const segmentCounterRef = useRef(0);

  const broadcastIdRef = useRef(broadcastId);
  broadcastIdRef.current = broadcastId;

  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => {
      if (a.markerType && b.markerType) {
        return b.timestamp - a.timestamp;
      }
      if (a.markerType) {
        return -1;
      }
      if (b.markerType) {
        return 1;
      }

      const aHasStartTime = a.startTimeSeconds !== undefined;
      const bHasStartTime = b.startTimeSeconds !== undefined;

      if (aHasStartTime && bHasStartTime) {
        return b.startTimeSeconds! - a.startTimeSeconds!;
      }

      return b.timestamp - a.timestamp;
    });
  }, [entries]);

  useEffect(() => {
    let cancelled = false;

    async function loadSegments() {
      if (status === "setup") {
        return;
      }

      if (!orgId) {
        console.warn("Skipping loadSegments: orgId is missing");
        return;
      }

      setIsLoadingSegments(true);
      try {
        const response = await fetch(`/api/broadcast/${broadcastId}/segments?orgId=${orgId}`);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
          console.error("Failed to load segments:", response.status, errorData);
          setEntries([]);
          return;
        }

        const data = await response.json();
        if (cancelled) {
          return;
        }

        const loadedEntries: TranscriptEntry[] = data.segments.map(
          (seg: BroadcastTranscriptSegment) => ({
            id: `loaded-${seg.id}`,
            speaker: seg.speakerLabel,
            text: seg.text,
            timestamp: new Date(seg.createdAt).getTime(),
            segmentIndex: seg.segmentIndex,
            startTimeSeconds: seg.startTime ?? undefined,
          })
        );

        setEntries(loadedEntries);
        segmentCounterRef.current = Math.max(
          ...data.segments.map((s: BroadcastTranscriptSegment) => s.segmentIndex),
          0
        );
      } catch (error) {
        console.error("Failed to load transcript segments:", error);
      } finally {
        if (!cancelled) {
          setIsLoadingSegments(false);
        }
      }
    }

    loadSegments();

    return () => {
      cancelled = true;
    };
  }, [broadcastId, status, orgId]);

  const scrollToTop = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, []);

  useEffect(() => {
    if (isAtLive) {
      scrollToTop();
    }
  }, [entries, isAtLive, scrollToTop]);

  const handleScroll = useCallback(() => {
    if (!containerRef.current) {
      return;
    }
    const atLive = containerRef.current.scrollTop < 50;
    setIsAtLive(atLive);
  }, []);

  useEffect(() => {
    if (status !== "live") {
      return;
    }

    setIsConnecting(true);

    const ws = new WebSocket(getTranscriptWsUrl(streamKey));
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnecting(false);
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.kind === "transcript_segment") {
          if (data.sessionStartedAt && sessionStartedAtRef.current === null) {
            sessionStartedAtRef.current = data.sessionStartedAt;
          }

          if (data.isFinal) {
            const segmentIndex = ++segmentCounterRef.current;
            const words = data.words as Array<{ start?: number; end?: number }> | undefined;
            const startTimeSeconds = words?.find((w) => w.start !== undefined)?.start ?? undefined;

            if (startTimeSeconds !== undefined && transcriptionStartSecondsRef.current === null) {
              transcriptionStartSecondsRef.current = startTimeSeconds;
            }

            const entry: TranscriptEntry = {
              id: data.segmentId || `${data.timestamp || Date.now()}-${Math.random()}`,
              speaker: formatSpeakerLabel(data.speaker),
              text: data.text,
              timestamp: Date.now(),
              segmentIndex,
              startTimeSeconds,
            };

            setEntries((prev) => [entry, ...prev]);
            setUncommittedSegments([]);
          } else {
            setUncommittedSegments((prev) => {
              const existing = prev.findIndex((s) => s.id === data.segmentId);
              const segment: UncommittedSegment = {
                id: data.segmentId,
                text: data.text,
                receivedAt: Date.now(),
              };
              if (existing !== -1) {
                const updated = [...prev];
                updated[existing] = segment;
                return updated;
              }
              return [...prev, segment];
            });
          }
        } else if (data.kind === "transcript_marker") {
          const entry: TranscriptEntry = {
            id: `marker-${data.timestamp}-${Math.random()}`,
            speaker: null,
            text: "",
            timestamp: data.timestamp,
            markerType: data.markerType,
            label: data.label,
            agendaItemId: data.agendaItemId,
            motionId: data.motionId,
          };

          if (data.markerType === "go_live" && !broadcastStartTimeRef.current) {
            broadcastStartTimeRef.current = data.timestamp;
          }

          setEntries((prev) => [entry, ...prev]);
        }
      } catch (err) {
        console.error("Failed to parse transcript message:", err);
      }
    };

    ws.onerror = () => {
      setIsConnecting(false);
      setIsConnected(false);
    };

    ws.onclose = () => {
      setIsConnecting(false);
      setIsConnected(false);
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [streamKey, status]);

  const handleTimestampClick = useCallback(
    (timestamp: number) => {
      if (!onSeek || !broadcastStartTimeRef.current) {
        return;
      }
      const secondsFromStart = (timestamp - broadcastStartTimeRef.current) / 1000;
      onSeek(secondsFromStart);
      setIsAtLive(false);
    },
    [onSeek]
  );

  const jumpToLive = useCallback(() => {
    scrollToTop();
    setIsAtLive(true);
  }, [scrollToTop]);

  if (status === "setup") {
    if (embedded) {
      return (
        <div className="h-full flex items-center justify-center p-6">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-muted flex items-center justify-center">
              <LuMic className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-sm">
              Transcription will start when your stream goes live
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="h-full flex flex-col bg-card rounded-xl border border-border overflow-hidden">
        <div className="p-3 border-b border-border flex items-center gap-2">
          <LuMic className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-medium text-foreground text-sm">Live Transcript</h3>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-muted flex items-center justify-center">
              <LuMic className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-sm">
              Transcription will start when your stream goes live
            </p>
          </div>
        </div>
      </div>
    );
  }

  const renderEntry = (entry: TranscriptEntry) => {
    if (entry.markerType) {
      return (
        <div
          key={entry.id}
          className={`flex items-center gap-2 p-2.5 rounded-lg border ${MARKER_COLORS[entry.markerType]}`}
        >
          {getMarkerIcon(entry.markerType)}
          <span className="text-xs font-semibold flex-1">
            {entry.label || MARKER_LABELS[entry.markerType]}
          </span>
          <span className="text-xs opacity-75">
            {formatTimestamp(entry.timestamp, broadcastStartTimeRef.current || undefined)}
          </span>
        </div>
      );
    }

    const getDisplayTime = () => {
      if (entry.startTimeSeconds !== undefined) {
        return formatDuration(entry.startTimeSeconds);
      }
      return "—:——";
    };

    return (
      <div key={entry.id} className="flex gap-2 items-start">
        <button
          type="button"
          onClick={() => handleTimestampClick(entry.timestamp)}
          className="text-xs font-mono shrink-0 cursor-pointer pt-0.5 w-12 flex justify-center text-muted-foreground hover:text-primary"
          title="Jump to this point in the video"
        >
          {getDisplayTime()}
        </button>
        <div className="w-px bg-border shrink-0 self-stretch" />
        <div className="flex-1 min-w-0">
          {entry.speaker && (
            <span className="text-xs font-medium text-primary block mb-0.5">{entry.speaker}</span>
          )}
          <p className="text-sm leading-relaxed text-foreground">{entry.text}</p>
        </div>
      </div>
    );
  };

  const renderUncommittedSegment = (
    segment: UncommittedSegment,
    index: number,
    isTopmost: boolean
  ) => {
    const getEstimatedTime = () => {
      if (sessionStartedAtRef.current) {
        const elapsedSeconds = (segment.receivedAt - sessionStartedAtRef.current) / 1000;
        return formatDuration(Math.max(0, elapsedSeconds));
      }
      return "—:——";
    };

    return (
      <div key={segment.id} className="flex gap-2 items-start">
        <span className="text-xs font-mono shrink-0 pt-0.5 w-12 flex justify-center text-muted-foreground">
          {isTopmost ? (
            <span className="flex items-center justify-center gap-0.5 h-4">
              {[0, 1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className="w-0.5 bg-red-500 rounded-full"
                  style={{
                    animation: "waveform 0.6s ease-in-out infinite",
                    animationDelay: `${i * 0.1}s`,
                    height: "12px",
                  }}
                />
              ))}
            </span>
          ) : (
            <span className="text-red-500">PROC</span>
          )}
        </span>
        <div className="w-px bg-border shrink-0 self-stretch" />
        <p className="text-sm text-foreground/70 italic leading-relaxed flex-1">{segment.text}</p>
      </div>
    );
  };

  const renderTranscriptContent = (emptyMessage?: string) => {
    if (isLoadingSegments) {
      return (
        <div className="flex items-center justify-center min-h-[150px]">
          <div className="text-center">
            <LuLoader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-muted-foreground" />
            <p className="text-muted-foreground text-sm">Loading transcript...</p>
          </div>
        </div>
      );
    }

    const allEmpty = entries.length === 0 && uncommittedSegments.length === 0;
    if (allEmpty) {
      return (
        <div className="flex items-center justify-center min-h-[150px]">
          <p className="text-muted-foreground text-sm">{emptyMessage ?? "Waiting for speech..."}</p>
        </div>
      );
    }

    return (
      <>
        {[...uncommittedSegments]
          .reverse()
          .map((segment, index) => renderUncommittedSegment(segment, index, index === 0))}
        {sortedEntries.map((entry) => renderEntry(entry))}
      </>
    );
  };

  if (embedded) {
    return (
      <div className="h-full flex flex-col overflow-hidden relative">
        {!isAtLive && entries.length > 0 && (
          <button
            type="button"
            onClick={jumpToLive}
            className="absolute top-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-full shadow-lg transition-colors"
          >
            <LuRadio className="w-3 h-3 animate-pulse" />
            <span>Jump to Live</span>
          </button>
        )}

        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-4 space-y-4"
        >
          {renderTranscriptContent(
            isConnecting ? "Connecting to transcription..." : "Waiting for speech..."
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-card rounded-xl border border-border overflow-hidden">
      <div className="p-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LuMic className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-medium text-foreground text-sm">Live Transcript</h3>
        </div>
        <div className="flex items-center gap-2">
          {isConnecting && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <LuLoader2 className="w-3 h-3 animate-spin" />
              <span>Connecting...</span>
            </div>
          )}
          {isConnected && (
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-xs text-green-600">Connected</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden relative">
        {!isAtLive && entries.length > 0 && (
          <button
            type="button"
            onClick={jumpToLive}
            className="absolute top-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-full shadow-lg transition-colors"
          >
            <LuRadio className="w-3 h-3 animate-pulse" />
            <span>Jump to Live</span>
          </button>
        )}

        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-4 space-y-4"
        >
          {renderTranscriptContent()}
        </div>
      </div>
    </div>
  );
}
