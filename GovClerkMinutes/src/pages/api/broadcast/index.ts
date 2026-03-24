import withErrorReporting from "@/error/withErrorReporting";
import { getAuth, createClerkClient } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { resolveRequestContext } from "@/utils/resolveRequestContext";
import { errorResponse, jsonResponse } from "@/utils/apiHelpers";
import { getPortalDbConnection } from "@/utils/portalDb";
import type {
  Broadcast,
  BroadcastWithMeeting,
  CreateBroadcastRequest,
  BroadcastResponse,
  ActiveBroadcastResponse,
} from "@/types/broadcast";
import { getClerkKeys } from "@/utils/clerk";
import { type Site } from "@/utils/site";

export const config = {
  runtime: "edge",
};

function generateStreamKey(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let key = "";
  for (let i = 0; i < 16; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}

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

async function handleGet(
  orgId: string,
  userId: string,
  searchParams: URLSearchParams,
  site: Site
): Promise<Response> {
  const conn = getPortalDbConnection();
  const meetingId = searchParams.get("meetingId");

  if (meetingId) {
    const result = await conn.execute(
      `SELECT b.*, m.id as meeting_id, m.title as meeting_title,
              m.description as meeting_description, m.meeting_date
       FROM gc_broadcasts b
       JOIN gc_meetings m ON b.meeting_id = m.id
       WHERE b.meeting_id = ? AND b.org_id = ? AND b.status != 'ended'
       ORDER BY b.created_at DESC LIMIT 1`,
      [meetingId, orgId]
    );

    if (result.rows.length === 0) {
      return jsonResponse({ broadcast: null, isOwner: false } as ActiveBroadcastResponse);
    }

    const broadcast = rowToBroadcastWithMeeting(result.rows[0]);
    const isOwner = broadcast.startedByUserId === userId;

    let ownerName: string | undefined;
    if (!isOwner) {
      try {
        const clerk = createClerkClient(getClerkKeys(site));
        const owner = await clerk.users.getUser(broadcast.startedByUserId);
        ownerName = owner.firstName || owner.username || "Unknown";
      } catch {
        ownerName = "Unknown";
      }
    }

    return jsonResponse({ broadcast, isOwner, ownerName } as ActiveBroadcastResponse);
  }

  const result = await conn.execute(
    `SELECT b.*, m.id as meeting_id, m.title as meeting_title,
            m.description as meeting_description, m.meeting_date
     FROM gc_broadcasts b
     JOIN gc_meetings m ON b.meeting_id = m.id
     WHERE b.org_id = ? AND b.status IN ('setup', 'live', 'paused')
     ORDER BY b.created_at DESC LIMIT 1`,
    [orgId]
  );

  if (result.rows.length === 0) {
    return jsonResponse({ broadcast: null, isOwner: false } as ActiveBroadcastResponse);
  }

  const broadcast = rowToBroadcastWithMeeting(result.rows[0]);
  const isOwner = broadcast.startedByUserId === userId;

  let ownerName: string | undefined;
  if (!isOwner) {
    try {
      const clerk = createClerkClient(getClerkKeys(site));
      const owner = await clerk.users.getUser(broadcast.startedByUserId);
      ownerName = owner.firstName || owner.username || "Unknown";
    } catch {
      ownerName = "Unknown";
    }
  }

  return jsonResponse({ broadcast, isOwner, ownerName } as ActiveBroadcastResponse);
}

async function handlePost(
  orgId: string,
  userId: string,
  body: CreateBroadcastRequest
): Promise<Response> {
  const conn = getPortalDbConnection();

  const meetingCheck = await conn.execute(
    "SELECT id FROM gc_meetings WHERE id = ? AND org_id = ?",
    [body.mgMeetingId, orgId]
  );

  if (meetingCheck.rows.length === 0) {
    return errorResponse("Meeting not found", 404);
  }

  const existingBroadcast = await conn.execute(
    "SELECT id FROM gc_broadcasts WHERE org_id = ? AND status IN ('setup', 'live', 'paused')",
    [orgId]
  );

  if (existingBroadcast.rows.length > 0) {
    return errorResponse("An active broadcast already exists for this organization", 409);
  }

  const streamKey = generateStreamKey();

  const result = await conn.transaction(async (tx) => {
    // Check for existing broadcasts for this meeting and delete their segments
    const previousBroadcasts = await tx.execute(
      "SELECT id FROM gc_broadcasts WHERE meeting_id = ?",
      [body.mgMeetingId]
    );

    if (previousBroadcasts.rows.length > 0) {
      const broadcastIds = previousBroadcasts.rows.map((row: any) => Number(row.id));
      const placeholders = broadcastIds.map(() => "?").join(",");
      await tx.execute(
        `DELETE FROM gc_broadcast_transcript_segments WHERE broadcast_id IN (${placeholders})`,
        broadcastIds
      );
    }

    await tx.execute(
      `INSERT INTO gc_broadcasts (org_id, meeting_id, started_by_user_id, stream_key, status)
       VALUES (?, ?, ?, ?, 'setup')`,
      [orgId, body.mgMeetingId, userId, streamKey]
    );

    const idResult = await tx.execute("SELECT LAST_INSERT_ID() as id");
    const id = Number((idResult.rows[0] as any).id);

    return tx.execute(
      `SELECT b.*, m.id as meeting_id, m.title as meeting_title,
              m.description as meeting_description, m.meeting_date
       FROM gc_broadcasts b
       JOIN gc_meetings m ON b.meeting_id = m.id
       WHERE b.id = ?`,
      [id]
    );
  });

  const broadcast = rowToBroadcastWithMeeting(result.rows[0]);
  return jsonResponse({ broadcast } as BroadcastResponse, 201);
}

async function handler(req: NextRequest): Promise<Response> {
  const auth = getAuth(req);
  if (!auth.userId) {
    return errorResponse("Unauthorized", 401);
  }

  const url = new URL(req.url);
  const body = req.method === "GET" ? {} : await req.json().catch(() => ({}));
  const orgIdParam = req.method === "GET" ? url.searchParams.get("orgId") : body.orgId;
  const { orgId, site } = await resolveRequestContext(auth.userId, orgIdParam, req.headers);

  if (!orgId) {
    return errorResponse("Organization required", 400);
  }

  switch (req.method) {
    case "GET":
      return handleGet(orgId, auth.userId, url.searchParams, site);
    case "POST":
      return handlePost(orgId, auth.userId, body);
    default:
      return errorResponse("Method not allowed", 405);
  }
}

export default withErrorReporting(handler);
