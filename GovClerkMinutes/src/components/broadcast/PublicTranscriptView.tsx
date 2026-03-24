import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { LuMic, LuLoader2 } from "react-icons/lu";
import { getTranscriptWsUrlByBroadcastId } from "@/sophon/config";
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
  slug: string;
  broadcastId: number;
  initialSegments?: BroadcastTranscriptSegment[];
};

type TranscriptEntry = {
  id: string;
  speaker: string | null;
  text: string;
  timestamp: number;
  markerType?: TranscriptMarkerType;
  label?: string;
  agendaItemId?: number;
  motionId?: number;
  startTimeSeconds?: number;
  segmentIndex?: number;
};

type UncommittedSegment = {
  id: string;
  text: string;
  receivedAt: number;
};

export function PublicTranscriptView({ slug, broadcastId, initialSegments = [] }: Readonly<Props>) {
  const [entries, setEntries] = useState<TranscriptEntry[]>([]);
  const [uncommittedSegments, setUncommittedSegments] = useState<UncommittedSegment[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const broadcastStartTimeRef = useRef<number | null>(null);
  const sessionStartedAtRef = useRef<number | null>(null);
  const segmentCounterRef = useRef(0);
  const minSegmentIndexRef = useRef<number | null>(null);
  const wasConnectedRef = useRef(false);
  const lastBroadcastIdRef = useRef<number | null>(null);

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
    if (lastBroadcastIdRef.current !== null && lastBroadcastIdRef.current !== broadcastId) {
      setEntries([]);
      setUncommittedSegments([]);
      segmentCounterRef.current = 0;
      minSegmentIndexRef.current = null;
      setHasMore(true);
      broadcastStartTimeRef.current = null;
    }
    lastBroadcastIdRef.current = broadcastId;
  }, [broadcastId]);

  useEffect(() => {
    if (initialSegments.length > 0) {
      const loadedEntries: TranscriptEntry[] = initialSegments.map((seg) => ({
        id: seg.id.toString(),
        speaker: seg.speakerLabel,
        text: seg.text,
        timestamp: new Date(seg.createdAt).getTime(),
        startTimeSeconds: seg.startTime ?? undefined,
        segmentIndex: seg.segmentIndex,
      }));
      setEntries(loadedEntries);
      segmentCounterRef.current = Math.max(...initialSegments.map((s) => s.segmentIndex), 0);
      minSegmentIndexRef.current = Math.min(...initialSegments.map((s) => s.segmentIndex));
      setHasMore(initialSegments.length >= 50);
    }
  }, [initialSegments]);

  const revalidateSegments = useCallback(async () => {
    try {
      const response = await fetch(`/api/public/portal/${slug}/live`);
      if (!response.ok) {
        return;
      }

      const data = await response.json();
      const newSegments: BroadcastTranscriptSegment[] = data.segments || [];

      if (newSegments.length === 0) {
        return;
      }

      setEntries((prev) => {
        const existingIds = new Set(prev.map((e) => e.id));
        const newEntries: TranscriptEntry[] = newSegments
          .filter((seg) => !existingIds.has(seg.id.toString()))
          .map((seg) => ({
            id: seg.id.toString(),
            speaker: seg.speakerLabel,
            text: seg.text,
            timestamp: new Date(seg.createdAt).getTime(),
            startTimeSeconds: seg.startTime ?? undefined,
            segmentIndex: seg.segmentIndex,
          }));

        if (newEntries.length === 0) {
          return prev;
        }

        const maxIndex = Math.max(
          ...newSegments.map((s) => s.segmentIndex),
          segmentCounterRef.current
        );
        segmentCounterRef.current = maxIndex;

        return [...newEntries, ...prev];
      });
    } catch (err) {
      console.error("Failed to revalidate segments:", err);
    }
  }, [slug]);

  const loadMoreSegments = useCallback(async () => {
    if (
      isLoadingMore ||
      !hasMore ||
      minSegmentIndexRef.current === null ||
      minSegmentIndexRef.current <= 0
    ) {
      return;
    }

    setIsLoadingMore(true);
    try {
      const response = await fetch(
        `/api/public/portal/${slug}/live?beforeIndex=${minSegmentIndexRef.current}&limit=50`
      );
      if (!response.ok) {
        setIsLoadingMore(false);
        return;
      }

      const data = await response.json();
      const olderSegments: BroadcastTranscriptSegment[] = data.segments || [];

      if (olderSegments.length === 0) {
        setHasMore(false);
        setIsLoadingMore(false);
        return;
      }

      const newEntries: TranscriptEntry[] = olderSegments.map((seg) => ({
        id: seg.id.toString(),
        speaker: seg.speakerLabel,
        text: seg.text,
        timestamp: new Date(seg.createdAt).getTime(),
        startTimeSeconds: seg.startTime ?? undefined,
        segmentIndex: seg.segmentIndex,
      }));

      minSegmentIndexRef.current = Math.min(...olderSegments.map((s) => s.segmentIndex));
      setHasMore(olderSegments.length >= 50 && minSegmentIndexRef.current > 0);

      setEntries((prev) => {
        const existingIds = new Set(prev.map((e) => e.id));
        const filtered = newEntries.filter((e) => !existingIds.has(e.id));
        return [...prev, ...filtered];
      });
    } catch (err) {
      console.error("Failed to load more segments:", err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [slug, isLoadingMore, hasMore]);

  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setIsConnecting(true);
    const wsUrl = getTranscriptWsUrlByBroadcastId(broadcastId);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.addEventListener("open", () => {
      setIsConnected(true);
      setIsConnecting(false);

      if (wasConnectedRef.current) {
        revalidateSegments();
      }
      wasConnectedRef.current = true;
    });

    ws.addEventListener("message", (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.kind === "transcript_segment") {
          if (data.sessionStartedAt && sessionStartedAtRef.current === null) {
            sessionStartedAtRef.current = data.sessionStartedAt;
          }

          if (data.isFinal) {
            ++segmentCounterRef.current;
            const words = data.words as Array<{ start?: number }> | undefined;
            const startTimeSeconds = words?.find((w) => w.start !== undefined)?.start ?? undefined;

            const entry: TranscriptEntry = {
              id: data.segmentId || `${data.timestamp || Date.now()}-${Math.random()}`,
              speaker: formatSpeakerLabel(data.speaker),
              text: data.text,
              timestamp: Date.now(),
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
        console.error("Failed to parse WebSocket message:", err);
      }
    });

    ws.addEventListener("close", () => {
      setIsConnected(false);
      setIsConnecting(false);
      reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
    });

    ws.addEventListener("error", (err) => {
      console.error("Public transcript WebSocket error:", err);
      setIsConnected(false);
      setIsConnecting(false);
    });
  }, [broadcastId, revalidateSegments]);

  useEffect(() => {
    connectWebSocket();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connectWebSocket]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (observerEntries) => {
        if (observerEntries[0].isIntersecting && hasMore && !isLoadingMore) {
          loadMoreSegments();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, loadMoreSegments]);

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
            {formatElapsedTime(entry.timestamp, broadcastStartTimeRef.current || undefined)}
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
        <span className="text-xs font-mono shrink-0 pt-0.5 w-12 flex justify-center text-muted-foreground">
          {getDisplayTime()}
        </span>
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

  const renderTranscriptContent = () => {
    const allEmpty = entries.length === 0 && uncommittedSegments.length === 0;
    if (allEmpty) {
      return (
        <div className="flex items-center justify-center min-h-[150px]">
          <div className="text-center">
            <LuLoader2 className="w-6 h-6 animate-spin text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Waiting for speech...</p>
          </div>
        </div>
      );
    }

    return (
      <>
        {[...uncommittedSegments]
          .reverse()
          .map((segment, index) => renderUncommittedSegment(segment, index, index === 0))}
        {sortedEntries.map((entry) => renderEntry(entry))}
        {hasMore && (
          <div ref={loadMoreRef} className="py-4 text-center">
            {isLoadingMore ? (
              <LuLoader2 className="w-5 h-5 animate-spin text-muted-foreground mx-auto" />
            ) : (
              <span className="text-xs text-muted-foreground">Scroll for more</span>
            )}
          </div>
        )}
      </>
    );
  };

  if (!isConnected && !isConnecting && entries.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border p-8 min-h-[200px] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-muted flex items-center justify-center">
            <LuMic className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground text-sm">Waiting for transcription to start...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden flex flex-col">
      <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
        <h2 className="font-medium text-foreground">Live Transcript</h2>
        {isConnected && (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
            <span className="text-xs text-muted-foreground">Live</span>
          </div>
        )}
      </div>

      <div ref={containerRef} className="p-4 space-y-4 max-h-[600px] overflow-y-auto flex-1">
        {renderTranscriptContent()}
      </div>
    </div>
  );
}
