import withErrorReporting from "@/error/withErrorReporting";
import { getAuth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { resolveRequestContext } from "@/utils/resolveRequestContext";
import { errorResponse, jsonResponse } from "@/utils/apiHelpers";
import { getPortalDbConnection } from "@/utils/portalDb";
import { getSophonHttpUrl } from "@/sophon/config";
import { waitUntil } from "@vercel/functions";
import type {
  Broadcast,
  BroadcastWithMeeting,
  UpdateBroadcastRequest,
  BroadcastResponse,
} from "@/types/broadcast";

export const config = {
  runtime: "edge",
};

function rowToBroadcast(row: any): Broadcast {
  let agendaTimestamps = [];
  if (row.agenda_timestamps) {
    try {
      agendaTimestamps =
        typeof row.agenda_timestamps === "string"
          ? JSON.parse(row.agenda_timestamps)
          : row.agenda_timestamps;
    } catch {
      agendaTimestamps = [];
    }
  }

  return {
    id: Number(row.id),
    orgId: row.org_id,
    mgMeetingId: Number(row.meeting_id),
    startedByUserId: row.started_by_user_id,
    streamKey: row.stream_key,
    status: row.status,
    currentAgendaItemId: row.current_agenda_item_id ? Number(row.current_agenda_item_id) : null,
    notes: row.notes ?? null,
    agendaTimestamps,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToBroadcastWithMeeting(row: any): BroadcastWithMeeting {
  return {
    ...rowToBroadcast(row),
    meeting: {
      id: Number(row.meeting_id),
      title: row.meeting_title,
      description: row.meeting_description,
      meetingDate: row.meeting_date,
    },
  };
}

function parseAgendaTimestamps(raw: any): any[] {
  if (!raw) {
    return [];
  }
  try {
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return [];
  }
}

function buildAgendaTimestamp(agendaItemId: number, recordingPositionMs?: number) {
  return {
    agendaItemId,
    activatedAt: new Date().toISOString(),
    recordingPositionMs: recordingPositionMs ?? null,
  };
}

async function handleGet(id: string, orgId: string): Promise<Response> {
  const conn = getPortalDbConnection();

  const result = await conn.execute(
    `SELECT b.*, m.id as meeting_id, m.title as meeting_title,
            m.description as meeting_description, m.meeting_date
     FROM gc_broadcasts b
     JOIN gc_meetings m ON b.meeting_id = m.id
     WHERE b.id = ? AND b.org_id = ?`,
    [id, orgId]
  );

  if (result.rows.length === 0) {
    return errorResponse("Broadcast not found", 404);
  }

  const broadcast = rowToBroadcastWithMeeting(result.rows[0]);
  return jsonResponse({ broadcast } as BroadcastResponse);
}

async function handlePut(
  id: string,
  orgId: string,
  userId: string,
  body: UpdateBroadcastRequest
): Promise<Response> {
  const conn = getPortalDbConnection();

  const existing = await conn.execute(
    "SELECT id, started_by_user_id, agenda_timestamps, stream_key, status FROM gc_broadcasts WHERE id = ? AND org_id = ?",
    [id, orgId]
  );

  if (existing.rows.length === 0) {
    return errorResponse("Broadcast not found", 404);
  }

  const broadcast = existing.rows[0] as any;
  if (broadcast.started_by_user_id !== userId) {
    return errorResponse("Only the broadcast owner can update it", 403);
  }

  const oldStatus = broadcast.status;
  const streamKey = broadcast.stream_key;

  const updates: string[] = [];
  const values: any[] = [];

  if (body.status !== undefined) {
    updates.push("status = ?");
    values.push(body.status);

    if (body.status === "live") {
      updates.push("started_at = COALESCE(started_at, NOW())");
    } else if (body.status === "ended") {
      updates.push("ended_at = NOW()");
    }
  }

  if (body.currentAgendaItemId !== undefined) {
    updates.push("current_agenda_item_id = ?");
    values.push(body.currentAgendaItemId);

    if (body.currentAgendaItemId !== null) {
      const currentTimestamps = parseAgendaTimestamps(broadcast.agenda_timestamps);
      currentTimestamps.push(
        buildAgendaTimestamp(body.currentAgendaItemId, body.recordingPositionMs)
      );
      updates.push("agenda_timestamps = ?");
      values.push(JSON.stringify(currentTimestamps));
    }
  }

  if (body.notes !== undefined) {
    updates.push("notes = ?");
    values.push(body.notes);
  }

  if (updates.length === 0) {
    return errorResponse("No fields to update", 400);
  }

  values.push(id, orgId);

  const result = await conn.transaction(async (tx) => {
    await tx.execute(
      `UPDATE gc_broadcasts SET ${updates.join(", ")} WHERE id = ? AND org_id = ?`,
      values
    );

    return tx.execute(
      `SELECT b.*, m.id as meeting_id, m.title as meeting_title,
              m.description as meeting_description, m.meeting_date
       FROM gc_broadcasts b
       JOIN gc_meetings m ON b.meeting_id = m.id
       WHERE b.id = ?`,
      [id]
    );
  });

  const updatedBroadcast = rowToBroadcastWithMeeting(result.rows[0]);

  // Start recording via Sophon only if status transitioned to "live"
  if (body.status === "live" && oldStatus !== "live" && streamKey) {
    waitUntil(
      fetch(getSophonHttpUrl("/recording/start"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ streamKey }),
      })
        .then((res) => {
          if (!res.ok) {
            console.error("[broadcast] Failed to start recording: " + res.status);
          }
        })
        .catch((err) => {
          console.error("[broadcast] Error starting recording:", err);
        })
    );
  }

  return jsonResponse({ broadcast: updatedBroadcast } as BroadcastResponse);
}

async function handleDelete(id: string, orgId: string, userId: string): Promise<Response> {
  const conn = getPortalDbConnection();

  const existing = await conn.execute(
    "SELECT id, started_by_user_id, stream_key FROM gc_broadcasts WHERE id = ? AND org_id = ?",
    [id, orgId]
  );

  if (existing.rows.length === 0) {
    return errorResponse("Broadcast not found", 404);
  }

  const broadcast = existing.rows[0] as any;
  if (broadcast.started_by_user_id !== userId) {
    return errorResponse("Only the broadcast owner can end it", 403);
  }

  await conn.execute(
    "UPDATE gc_broadcasts SET status = 'ended', ended_at = NOW() WHERE id = ? AND org_id = ?",
    [id, orgId]
  );

  // End recording via Sophon
  const streamKey = broadcast.stream_key;
  if (streamKey) {
    waitUntil(
      fetch(getSophonHttpUrl("/recording/end"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ streamKey }),
      })
        .then((res) => {
          if (!res.ok) {
            console.error("[broadcast] Failed to end recording: " + res.status);
          }
        })
        .catch((err) => {
          console.error("[broadcast] Error ending recording:", err);
        })
    );
  }

  // Export notes via Sophon (fire-and-forget with waitUntil for Edge reliability)
  waitUntil(
    fetch(getSophonHttpUrl(`/broadcast/${id}/export-notes`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
      .then((res) => {
        if (!res.ok) {
          console.error(`[broadcast] Failed to trigger notes export: ${res.status}`);
        }
      })
      .catch((err) => {
        console.error("[broadcast] Error triggering notes export:", err);
      })
  );

  return jsonResponse({ success: true });
}

async function handler(req: NextRequest): Promise<Response> {
  const auth = getAuth(req);
  if (!auth.userId) {
    return errorResponse("Unauthorized", 401);
  }

  const url = new URL(req.url);
  const id = url.pathname.split("/").pop()!;
  const body = req.method === "GET" ? {} : await req.json().catch(() => ({}));
  const orgIdParam = req.method === "GET" ? url.searchParams.get("orgId") : body.orgId;

  const { orgId } = await resolveRequestContext(auth.userId, orgIdParam, req.headers);

  if (!orgId) {
    return errorResponse("Organization required", 400);
  }

  switch (req.method) {
    case "GET":
      return handleGet(id, orgId);
    case "PUT":
      return handlePut(id, orgId, auth.userId, body);
    case "DELETE":
      return handleDelete(id, orgId, auth.userId);
    default:
      return errorResponse("Method not allowed", 405);
  }
}

export default withErrorReporting(handler);
