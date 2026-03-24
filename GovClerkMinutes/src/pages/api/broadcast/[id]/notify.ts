import withErrorReporting from "@/error/withErrorReporting";
import { getAuth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { resolveRequestContext } from "@/utils/resolveRequestContext";
import { errorResponse, jsonResponse } from "@/utils/apiHelpers";
import { getPortalDbConnection } from "@/utils/portalDb";
import { getSophonHttpUrl } from "@/sophon/config";

export const config = {
  runtime: "edge",
};

type NotifyType = "broadcast_update" | "agenda_update";

interface NotifyRequestBody {
  type: NotifyType;
  currentAgendaItemId?: number | null;
  status?: string;
  orgId?: string;
}

async function handler(req: NextRequest): Promise<Response> {
  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  const auth = getAuth(req);
  if (!auth.userId) {
    return errorResponse("Unauthorized", 401);
  }

  const body: NotifyRequestBody = await req.json();
  const { type, currentAgendaItemId, status, orgId: orgIdParam } = body;

  const { orgId } = await resolveRequestContext(auth.userId, orgIdParam, req.headers);

  if (!orgId) {
    return errorResponse("Organization required", 400);
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/");
  const broadcastId = Number.parseInt(pathParts[pathParts.indexOf("broadcast") + 1]);

  if (!type) {
    return errorResponse("type is required", 400);
  }

  const conn = getPortalDbConnection();

  const broadcastResult = await conn.execute(
    "SELECT stream_key, meeting_id, current_agenda_item_id, status, agenda_timestamps FROM gc_broadcasts WHERE id = ? AND org_id = ?",
    [broadcastId, orgId]
  );

  if (broadcastResult.rows.length === 0) {
    return errorResponse("Broadcast not found", 404);
  }

  const broadcast = broadcastResult.rows[0] as any;
  const streamKey = broadcast.stream_key;

  // Parse agenda_timestamps from JSON column
  let agendaTimestamps: Array<{
    agendaItemId: number;
    activatedAt: string;
    recordingPositionMs: number | null;
  }> = [];
  if (broadcast.agenda_timestamps) {
    try {
      const parsed =
        typeof broadcast.agenda_timestamps === "string"
          ? JSON.parse(broadcast.agenda_timestamps)
          : broadcast.agenda_timestamps;
      agendaTimestamps = parsed;
    } catch {
      agendaTimestamps = [];
    }
  }

  // Use values from request body if provided (for real-time accuracy),
  // otherwise fall back to database values
  const dbAgendaItemId = broadcast.current_agenda_item_id
    ? Number(broadcast.current_agenda_item_id)
    : null;
  const effectiveCurrentAgendaItemId =
    currentAgendaItemId === undefined ? dbAgendaItemId : currentAgendaItemId;
  const effectiveStatus = status ?? broadcast.status;

  try {
    const sophonResponse = await fetch(getSophonHttpUrl("/transcribe/notify"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        streamKey,
        notifyType: type,
        broadcastId,
        meetingId: Number(broadcast.meeting_id),
        currentAgendaItemId: effectiveCurrentAgendaItemId,
        status: effectiveStatus,
        agendaTimestamps,
      }),
    });

    if (!sophonResponse.ok) {
      console.warn("Failed to send notification to Sophon:", await sophonResponse.text());
    }

    return jsonResponse({ ok: true });
  } catch (err) {
    console.error("Failed to send notification:", err);
    return jsonResponse({ ok: true, warning: "Notification failed" });
  }
}

export default withErrorReporting(handler);
