import { useState, useEffect, useCallback } from "react";
import { getTranscriptWsUrlByBroadcastId } from "@/sophon/config";
import type { SophonWebSocket } from "@/sophon/types";
import type {
  BroadcastWithMeeting,
  BroadcastTranscriptSegment,
  BroadcastStatus,
} from "@/types/broadcast";
import type { MgAgendaItemWithRelations } from "@/types/agenda";

type Props = {
  slug: string;
  initialBroadcast: BroadcastWithMeeting | null;
  initialAgenda: MgAgendaItemWithRelations[];
  initialSegments: BroadcastTranscriptSegment[];
};

function updateBroadcastFromMessage(
  prev: BroadcastWithMeeting | null,
  message: SophonWebSocket.BroadcastUpdate
): BroadcastWithMeeting | null {
  if (!prev) {
    return prev;
  }
  return {
    ...prev,
    currentAgendaItemId: message.currentAgendaItemId,
    status: message.status as BroadcastStatus,
    agendaTimestamps: message.agendaTimestamps ?? prev.agendaTimestamps,
  };
}

export function usePublicLiveBroadcast({
  slug,
  initialBroadcast,
  initialAgenda,
  initialSegments,
}: Props) {
  const [broadcast, setBroadcast] = useState<BroadcastWithMeeting | null>(initialBroadcast);
  const [agenda, setAgenda] = useState<MgAgendaItemWithRelations[]>(initialAgenda);
  const [segments, setSegments] = useState<BroadcastTranscriptSegment[]>(initialSegments);
  const [isLoading, setIsLoading] = useState(false);

  const reloadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/public/portal/${slug}/live`);
      if (response.ok) {
        const data = await response.json();
        setBroadcast(data.broadcast);
        setAgenda(data.agenda || []);
        setSegments(data.segments || []);
      }
    } catch (err) {
      console.error("Failed to reload live data:", err);
    } finally {
      setIsLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    if (!broadcast?.id) {
      return;
    }

    const wsUrl = getTranscriptWsUrlByBroadcastId(broadcast.id);
    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    function handleWebSocketMessage(event: MessageEvent) {
      try {
        const message: SophonWebSocket.IncomingMessage = JSON.parse(event.data);

        if (message.kind === "broadcast_update") {
          setBroadcast((prev) => updateBroadcastFromMessage(prev, message));
        }

        if (message.kind === "agenda_update") {
          reloadData();
        }

        if (message.kind === "stream_ended" || message.kind === "stream_timeout") {
          console.info(`[PublicLiveBroadcast] Stream ${message.kind} - resetting broadcast state`);
          setBroadcast(null);
          reloadData();
        }
      } catch (err) {
        console.error("Failed to parse WebSocket message:", err);
      }
    }

    function connect() {
      if (ws?.readyState === WebSocket.OPEN || ws?.readyState === WebSocket.CONNECTING) {
        return;
      }

      ws = new WebSocket(wsUrl);

      ws.addEventListener("open", () => {});
      ws.addEventListener("message", handleWebSocketMessage);
      ws.addEventListener("close", () => {
        reconnectTimeout = setTimeout(connect, 3000);
      });
      ws.addEventListener("error", (err) => {
        console.error("WebSocket error:", err);
      });
    }

    connect();

    return () => {
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (ws) {
        ws.close();
      }
    };
  }, [broadcast?.id, reloadData]);

  return {
    broadcast,
    agenda,
    segments,
    isLoading,
    reloadData,
  };
}
