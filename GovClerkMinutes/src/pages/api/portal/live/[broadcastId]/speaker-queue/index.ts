import { NextRequest } from "next/server";
import { errorResponse, jsonResponse } from "@/utils/apiHelpers";
import { getPortalDbConnection } from "@/utils/portalDb";
import { requirePortalAuth } from "@/portal-auth/requirePortalAuth";
import type { PortalSessionPayload } from "@/portal-auth/portalAuth";
import type { SpeakerQueueEntry } from "@/types/liveSession";

export const config = {
  runtime: "edge",
};

function rowToEntry(row: any): SpeakerQueueEntry {
  return {
    id: Number(row.id),
    orgId: row.org_id,
    broadcastId: Number(row.broadcast_id),
    speakerName: row.speaker_name,
    speakerType: row.speaker_type,
    agendaItemId: row.agenda_item_id ? Number(row.agenda_item_id) : null,
    position: Number(row.position),
    status: row.status,
    timeLimitSeconds: Number(row.time_limit_seconds),
    startedSpeakingAt: row.started_speaking_at ?? null,
    finishedSpeakingAt: row.finished_speaking_at ?? null,
    createdAt: row.created_at,
  };
}

async function handler(req: NextRequest, session: PortalSessionPayload): Promise<Response> {
  const url = new URL(req.url);
  const pathParts = url.pathname.split("/");
  const broadcastId = Number(pathParts[pathParts.indexOf("live") + 1]);

  if (!broadcastId || isNaN(broadcastId)) {
    return errorResponse("Invalid broadcast ID", 400);
  }

  const { orgId } = session;
  const conn = getPortalDbConnection();

  if (req.method === "GET") {
    const result = await conn.execute(
      "SELECT * FROM gc_portal_speaker_queue WHERE broadcast_id = ? AND org_id = ? ORDER BY position",
      [broadcastId, orgId]
    );
    const queue = result.rows.map(rowToEntry);
    return jsonResponse({ queue });
  }

  if (req.method === "POST") {
    const body = await req.json();
    const { speakerName, speakerType, agendaItemId, timeLimitSeconds } = body as {
      speakerName: string;
      speakerType?: string;
      agendaItemId?: number;
      timeLimitSeconds?: number;
    };

    if (!speakerName) {
      return errorResponse("speakerName is required", 400);
    }

    const validTypes = ["council_member", "public", "staff", "guest"];
    const resolvedType = speakerType ?? "council_member";
    if (!validTypes.includes(resolvedType)) {
      return errorResponse("Invalid speaker type", 400);
    }

    // Get next position
    const posResult = await conn.execute(
      "SELECT COALESCE(MAX(position), 0) + 1 as next_pos FROM gc_portal_speaker_queue WHERE broadcast_id = ? AND org_id = ? AND status IN ('waiting','speaking')",
      [broadcastId, orgId]
    );
    const nextPos = Number((posResult.rows[0] as any).next_pos);

    await conn.execute(
      `INSERT INTO gc_portal_speaker_queue (org_id, broadcast_id, speaker_name, speaker_type, agenda_item_id, position, time_limit_seconds)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        orgId,
        broadcastId,
        speakerName,
        resolvedType,
        agendaItemId ?? null,
        nextPos,
        timeLimitSeconds ?? 300,
      ]
    );

    const result = await conn.execute(
      "SELECT * FROM gc_portal_speaker_queue WHERE broadcast_id = ? AND org_id = ? ORDER BY id DESC LIMIT 1",
      [broadcastId, orgId]
    );
    const entry = rowToEntry(result.rows[0] as any);
    return jsonResponse({ entry }, 201);
  }

  return errorResponse("Method not allowed", 405);
}

export default requirePortalAuth(handler);
