import { S3RequestPresigner } from "@aws-sdk/s3-request-presigner";
import { HttpRequest } from "@smithy/protocol-http";
import { Hash } from "@aws-sdk/hash-node";
import { formatUrl } from "@aws-sdk/util-format-url";
import { assertString } from "@/utils/assert";
import { DEFAULT_REGION, getTranscriptBucketNameByRegion, getUploadKey } from "@/utils/s3";
import { PRESIGNED_URL_TTL } from "@/common/constants";
import { isDev } from "@/utils/dev";
import { serverUri } from "@/utils/server";
import type { Connection } from "@planetscale/database";

export type TranscriptSegment = {
  id: number;
  broadcastId: number;
  segmentIndex: number;
  speakerId: string | null;
  speakerLabel: string | null;
  text: string;
  startTime: number | null;
  endTime: number | null;
  isFinal: boolean;
  createdAt: string;
};

export async function uploadTranscriptToS3(
  transcriptId: number,
  transcriptText: string
): Promise<void> {
  const region = DEFAULT_REGION;
  const bucket = getTranscriptBucketNameByRegion(region);
  const bucketHost = `${bucket}.s3.${region}.amazonaws.com`;
  const s3Key = getUploadKey(transcriptId, { env: isDev() ? "dev" : "prod" });

  const presigner = new S3RequestPresigner({
    credentials: {
      accessKeyId: assertString(process.env.AWS_ACCESS_KEY_ID),
      secretAccessKey: assertString(process.env.AWS_SECRET_ACCESS_KEY),
    },
    region,
    sha256: Hash.bind(null, "sha256"),
  });

  const uploadRequest = await presigner.presign(
    new HttpRequest({
      protocol: "https",
      hostname: bucketHost,
      method: "PUT",
      path: `/${s3Key}`,
      headers: {
        host: bucketHost,
        "content-type": "text/plain; charset=utf-8",
      },
    }),
    { expiresIn: PRESIGNED_URL_TTL }
  );

  const uploadUrl = formatUrl(uploadRequest);
  const textBytes = new TextEncoder().encode(transcriptText);

  const response = await fetch(uploadUrl, {
    method: "PUT",
    body: Buffer.from(textBytes),
    headers: {
      "content-type": "text/plain; charset=utf-8",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to upload transcript to S3: ${response.status} ${response.statusText}`);
  }
}

export async function fetchBroadcastSegments(
  conn: Connection,
  broadcastId: number
): Promise<TranscriptSegment[]> {
  const segmentsResult = await conn.execute(
    `SELECT 
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
     WHERE broadcast_id = ?
     ORDER BY segment_index ASC`,
    [broadcastId]
  );

  return segmentsResult.rows as TranscriptSegment[];
}

export function formatSegmentsAsTranscript(segments: TranscriptSegment[]): string {
  return segments
    .map((segment) => {
      const speaker = segment.speakerLabel || "Speaker";
      return `${speaker}: ${segment.text}`;
    })
    .join("\n");
}

export async function findLatestBroadcastForMeeting(
  conn: Connection,
  meetingId: string,
  orgId: string
): Promise<number | null> {
  const broadcastResult = await conn.execute(
    `SELECT id FROM gc_broadcasts 
     WHERE meeting_id = ? AND org_id = ? AND status IN ('active', 'ended')
     ORDER BY created_at DESC LIMIT 1`,
    [meetingId, orgId]
  );

  if (broadcastResult.rows.length === 0) {
    return null;
  }

  return Number((broadcastResult.rows[0] as { id: number }).id);
}

export async function createMinutesTranscript(
  conn: Connection,
  userId: string,
  orgId: string,
  title: string,
  transcriptText: string,
  language?: string
): Promise<number> {
  const transcriptResult = await conn.execute(
    `INSERT INTO transcripts
     (userId, org_id, dateCreated, title, file_size, aws_region, upload_kind, recording_state, extension,
      transcribe_finished, preview_transcribe_finished, upload_complete, language)
     VALUES (?, ?, UTC_TIMESTAMP(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, orgId, title, transcriptText.length, DEFAULT_REGION, "text", -1, null, 1, 1, 1, language || null]
  );

  return Number(transcriptResult.insertId);
}

export async function linkMinutesToMeeting(
  conn: Connection,
  meetingId: string,
  orgId: string,
  transcriptId: number
): Promise<void> {
  await conn.execute(
    "UPDATE gc_meetings SET minutes_transcript_id = ?, minutes_version = NULL WHERE id = ? AND org_id = ?",
    [transcriptId, meetingId, orgId]
  );
}

export async function clearMinutesFromMeeting(
  conn: Connection,
  meetingId: string,
  orgId: string
): Promise<void> {
  await conn.execute(
    "UPDATE gc_meetings SET minutes_transcript_id = NULL, minutes_version = NULL WHERE id = ? AND org_id = ?",
    [meetingId, orgId]
  );
}

export async function findCompletedRecordingForBroadcast(
  conn: Connection,
  broadcastId: number
): Promise<{ s3Key: string; durationMs: number | null } | null> {
  const result = await conn.execute(
    `SELECT s3_key, duration_ms FROM gc_broadcast_recordings 
     WHERE broadcast_id = ? AND status = 'completed' AND s3_key IS NOT NULL 
     ORDER BY created_at DESC LIMIT 1`,
    [broadcastId]
  );
  if (result.rows.length === 0) {
    return null;
  }
  const row = result.rows[0] as { s3_key: string; duration_ms: number | null };
  return { s3Key: row.s3_key, durationMs: row.duration_ms };
}

export async function createAudioMinutesTranscript(
  conn: Connection,
  userId: string,
  orgId: string,
  title: string,
  language?: string
): Promise<number> {
  const result = await conn.execute(
    `INSERT INTO transcripts
     (userId, org_id, dateCreated, title, file_size, aws_region, upload_kind, recording_state, extension,
      transcribe_finished, preview_transcribe_finished, upload_complete, credits_required, transcribe_paused, language)
     VALUES (?, ?, UTC_TIMESTAMP(), ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, orgId, title, DEFAULT_REGION, "audio", -1, "mp4", 0, 0, 0, 0, 1, language || null]
  );
  return Number(result.insertId);
}

export async function copyRecordingToUploadKey(
  recordingS3Key: string,
  transcriptId: number
): Promise<void> {
  const { S3Client, CopyObjectCommand } = await import("@aws-sdk/client-s3");
  const bucket = getTranscriptBucketNameByRegion(DEFAULT_REGION);
  const destKey = getUploadKey(transcriptId);

  const client = new S3Client({
    region: DEFAULT_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });

  await client.send(
    new CopyObjectCommand({
      Bucket: bucket,
      CopySource: `${bucket}/${recordingS3Key}`,
      Key: destKey,
    })
  );
}

export async function triggerAudioDiarization(transcriptId: number, language?: string): Promise<void> {
  const s3AudioKey = getUploadKey(transcriptId, { env: isDev() ? "dev" : "prod" });
  const testQueryParam = isDev() ? "?test=1" : "";

  const body: Record<string, unknown> = { s3_audio_key: s3AudioKey };
  if (language && language !== "auto") {
    body.language = language;
  }

  const response = await fetch(serverUri(`/api/get-diarization${testQueryParam}`), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${assertString(process.env.UPLOAD_COMPLETE_WEBHOOK_SECRET)}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Diarization trigger failed: ${response.status} ${response.statusText}`);
  }
}
