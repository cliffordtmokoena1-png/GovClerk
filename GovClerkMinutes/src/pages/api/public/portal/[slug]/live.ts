import withErrorReporting from "@/error/withErrorReporting";
import { NextRequest } from "next/server";
import { errorResponse, jsonResponse } from "@/utils/apiHelpers";
import { getPortalDbConnection } from "@/utils/portalDb";
import type { BroadcastWithMeeting } from "@/types/broadcast";
import { buildTree } from "@/hooks/portal/useAgenda";
import type { StreamConfig, Motion, Vote, AttendanceRecord, SpeakerQueueEntry, PublicComment } from "@/types/liveSession";

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

function rowToStreamConfig(row: any): StreamConfig {
  return {
    id: Number(row.id),
    orgId: row.org_id,
    youtubeLiveUrl: row.youtube_live_url ?? null,
    youtubeChannelId: row.youtube_channel_id ?? null,
    zoomJoinUrl: row.zoom_join_url ?? null,
    zoomWebinarId: row.zoom_webinar_id ?? null,
    googleMeetUrl: row.google_meet_url ?? null,
    facebookLiveUrl: row.facebook_live_url ?? null,
    facebookPageId: row.facebook_page_id ?? null,
    rtmpHlsUrl: row.rtmp_hls_url ?? null,
    customEmbedUrl: row.custom_embed_url ?? null,
    preferredPlatform: row.preferred_platform ?? "youtube",
    isActive: Boolean(row.is_active),
  };
}

function rowToMotion(row: any): Motion {
  return {
    id: Number(row.id),
    orgId: row.org_id,
    broadcastId: Number(row.broadcast_id),
    meetingId: Number(row.meeting_id),
    agendaItemId: row.agenda_item_id ? Number(row.agenda_item_id) : null,
    motionType: row.motion_type,
    title: row.title,
    description: row.description ?? null,
    movedBy: row.moved_by ?? null,
    secondedBy: row.seconded_by ?? null,
    status: row.status,
    voteResultSummary: row.vote_result_summary ?? null,
    ordinal: Number(row.ordinal),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToVote(row: any): Vote {
  return {
    id: Number(row.id),
    orgId: row.org_id,
    motionId: Number(row.motion_id),
    broadcastId: Number(row.broadcast_id),
    memberName: row.member_name,
    memberId: row.member_id ?? null,
    vote: row.vote,
    votedAt: row.voted_at,
  };
}

function rowToAttendance(row: any): AttendanceRecord {
  return {
    id: Number(row.id),
    orgId: row.org_id,
    meetingId: Number(row.meeting_id),
    broadcastId: Number(row.broadcast_id),
    memberName: row.member_name,
    memberId: row.member_id ?? null,
    status: row.status,
    arrivedAt: row.arrived_at ?? null,
    departedAt: row.departed_at ?? null,
  };
}

function rowToSpeakerQueue(row: any): SpeakerQueueEntry {
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

function rowToPublicComment(row: any): PublicComment {
  return {
    id: Number(row.id),
    orgId: row.org_id,
    meetingId: Number(row.meeting_id),
    broadcastId: row.broadcast_id ? Number(row.broadcast_id) : null,
    agendaItemId: row.agenda_item_id ? Number(row.agenda_item_id) : null,
    speakerName: row.speaker_name,
    speakerEmail: row.speaker_email ?? null,
    topic: row.topic,
    commentText: row.comment_text ?? null,
    status: row.status,
    positionInQueue: row.position_in_queue ? Number(row.position_in_queue) : null,
    timeLimitSeconds: Number(row.time_limit_seconds),
    submittedAt: row.submitted_at,
    spokenAt: row.spoken_at ?? null,
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

  // Fetch stream config (public-safe fields only — no stream keys)
  const streamConfigResult = await conn.execute(
    `SELECT id, org_id, youtube_channel_id, youtube_live_url, zoom_join_url, zoom_webinar_id,
            google_meet_url, facebook_page_id, facebook_live_url, rtmp_hls_url,
            custom_embed_url, preferred_platform, is_active
     FROM gc_portal_stream_config
     WHERE org_id = ? AND is_active = 1
     LIMIT 1`,
    [orgId]
  );

  const streamConfig =
    streamConfigResult.rows.length > 0 ? rowToStreamConfig(streamConfigResult.rows[0] as any) : null;

  if (broadcastResult.rows.length === 0) {
    return jsonResponse({
      broadcast: null,
      agenda: [],
      segments: [],
      streamConfig,
      motions: [],
      attendance: [],
      speakerQueue: [],
      publicCommentQueue: [],
    });
  }

  const broadcast = rowToBroadcast(broadcastResult.rows[0]);
  const broadcastId = broadcast.id;

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

  const segmentParams: (number | string)[] = [broadcastId];

  if (beforeIndex !== null) {
    segmentQuery += " AND segment_index < ?";
    segmentParams.push(beforeIndex);
  }

  segmentQuery += " ORDER BY segment_index DESC LIMIT ?";
  segmentParams.push(limit);

  const [segmentsResult, motionsResult, votesResult, attendanceResult, speakerQueueResult, publicCommentsResult] =
    await Promise.all([
      conn.execute(segmentQuery, segmentParams),
      conn.execute(
        "SELECT * FROM gc_portal_motions WHERE broadcast_id = ? AND org_id = ? ORDER BY ordinal",
        [broadcastId, orgId]
      ),
      conn.execute(
        "SELECT * FROM gc_portal_votes WHERE broadcast_id = ? AND org_id = ?",
        [broadcastId, orgId]
      ),
      conn.execute(
        "SELECT * FROM gc_portal_attendance WHERE broadcast_id = ? AND org_id = ?",
        [broadcastId, orgId]
      ),
      conn.execute(
        "SELECT * FROM gc_portal_speaker_queue WHERE broadcast_id = ? AND org_id = ? AND status IN ('waiting','speaking') ORDER BY position",
        [broadcastId, orgId]
      ),
      conn.execute(
        "SELECT * FROM gc_portal_public_comments WHERE broadcast_id = ? AND org_id = ? AND status = 'approved' ORDER BY position_in_queue",
        [broadcastId, orgId]
      ),
    ]);

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

  const votes = votesResult.rows.map(rowToVote);
  const motions = motionsResult.rows.map((row: any) => {
    const motion = rowToMotion(row);
    motion.votes = votes.filter((vote) => vote.motionId === motion.id);
    return motion;
  });

  const attendance = attendanceResult.rows.map(rowToAttendance);
  const speakerQueue = speakerQueueResult.rows.map(rowToSpeakerQueue);
  const publicCommentQueue = publicCommentsResult.rows.map(rowToPublicComment);

  const { streamKey: _removed, ...publicBroadcast } = broadcast;
  return jsonResponse({
    broadcast: publicBroadcast,
    agenda: tree,
    segments,
    streamConfig,
    motions,
    attendance,
    speakerQueue,
    publicCommentQueue,
  });
}

export default withErrorReporting(handler);
