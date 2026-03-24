import withErrorReporting from "@/error/withErrorReporting";
import { NextRequest } from "next/server";
import { errorResponse, jsonResponse } from "@/utils/apiHelpers";
import { getPortalDbConnection } from "@/utils/portalDb";
import type { BroadcastWithMeeting } from "@/types/broadcast";
import { buildTree } from "@/hooks/portal/useAgenda";

export const config = {
  runtime: "edge",
};

function rowToBroadcast(row: any): BroadcastWithMeeting {
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
    meeting: {
      id: Number(row.meeting_id),
      title: row.meeting_title,
      description: row.meeting_description,
      meetingDate: row.meeting_date,
    },
  };
}

function rowToAgendaItem(row: any) {
  return {
    id: Number(row.id),
    orgId: row.org_id,
    mgAgendaId: Number(row.agenda_id),
    title: row.title,
    description: row.description,
    ordinal: Number(row.ordinal),
    isSection: Boolean(row.is_section),
    parent_id: row.parent_id ? Number(row.parent_id) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function handler(req: NextRequest): Promise<Response> {
  if (req.method !== "GET") {
    return errorResponse("Method not allowed", 405);
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/");
  const slugIndex = pathParts.indexOf("portal") + 1;
  const slug = pathParts[slugIndex];

  if (!slug) {
    return errorResponse("Portal slug is required", 400);
  }

  const conn = getPortalDbConnection();

  const settingsResult = await conn.execute(
    "SELECT id, org_id FROM gc_portal_settings WHERE slug = ? AND is_enabled = true",
    [slug]
  );

  if (settingsResult.rows.length === 0) {
    return errorResponse("Portal not found", 404);
  }

  const settings = settingsResult.rows[0] as any;
  const orgId = settings.org_id;

  const broadcastResult = await conn.execute(
    `SELECT b.*, m.id as meeting_id, m.title as meeting_title,
            m.description as meeting_description, m.meeting_date
     FROM gc_broadcasts b
     JOIN gc_meetings m ON b.meeting_id = m.id
     WHERE b.org_id = ? AND b.status IN ('live', 'paused')
     ORDER BY b.created_at DESC LIMIT 1`,
    [orgId]
  );

  if (broadcastResult.rows.length === 0) {
    return jsonResponse({ broadcast: null, agenda: [] });
  }

  const broadcast = rowToBroadcast(broadcastResult.rows[0]);

  const agendaResult = await conn.execute(
    `SELECT ai.* FROM gc_agenda_items ai
     JOIN gc_agendas a ON ai.agenda_id = a.id
     WHERE a.meeting_id = ? AND ai.org_id = ?
     ORDER BY ai.ordinal`,
    [broadcast.mgMeetingId, orgId]
  );

  const items = agendaResult.rows.map(rowToAgendaItem);
  const tree = buildTree(items as any);

  const limit = Number(url.searchParams.get("limit")) || 50;
  const beforeIndex = url.searchParams.get("beforeIndex")
    ? Number(url.searchParams.get("beforeIndex"))
    : null;

  let segmentQuery = `SELECT
      id,
      broadcast_id as broadcastId,
      segment_index as segmentIndex,
      speaker_id as speakerId,
      speaker_label as speakerLabel,
      text,
      start_time as startTime,
      end_time as endTime,
      is_final as isFinal,
      created_at as createdAt
    FROM gc_broadcast_transcript_segments
    WHERE broadcast_id = ?`;

  const segmentParams: (number | string)[] = [broadcast.id];

  if (beforeIndex !== null) {
    segmentQuery += " AND segment_index < ?";
    segmentParams.push(beforeIndex);
  }

  segmentQuery += " ORDER BY segment_index DESC LIMIT ?";
  segmentParams.push(limit);

  const segmentsResult = await conn.execute(segmentQuery, segmentParams);

  const segments = segmentsResult.rows.map((row: any) => ({
    id: Number(row.id),
    broadcastId: Number(row.broadcastId),
    segmentIndex: Number(row.segmentIndex),
    speakerId: row.speakerId,
    speakerLabel: row.speakerLabel,
    text: row.text,
    startTime: row.startTime ? Number(row.startTime) : null,
    endTime: row.endTime ? Number(row.endTime) : null,
    isFinal: Boolean(row.isFinal),
    createdAt: row.createdAt,
  }));

  const { streamKey: _removed, ...publicBroadcast } = broadcast;
  return jsonResponse({ broadcast: publicBroadcast, agenda: tree, segments });
}

export default withErrorReporting(handler);
