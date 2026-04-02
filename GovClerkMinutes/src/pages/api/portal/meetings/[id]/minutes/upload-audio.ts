import withErrorReporting from "@/error/withErrorReporting";
import { getAuth } from "@clerk/nextjs/server";
import type { NextApiRequest, NextApiResponse } from "next";
import { resolveRequestContext } from "@/utils/resolveRequestContext";
import { getPortalDbConnection } from "@/utils/portalDb";
import { S3RequestPresigner } from "@aws-sdk/s3-request-presigner";
import { HttpRequest } from "@smithy/protocol-http";
import { Hash } from "@aws-sdk/hash-node";
import { formatUrl } from "@aws-sdk/util-format-url";
import { assertString } from "@/utils/assert";
import { DEFAULT_REGION, getTranscriptBucketNameByRegion, getUploadKey } from "@/utils/s3";
import { PRESIGNED_URL_TTL } from "@/common/constants";
import { isDev } from "@/utils/dev";
import {
  createAudioMinutesTranscript,
  linkMinutesToMeeting,
  triggerAudioDiarization,
} from "@/utils/minutesGeneration";

export const config = {
  runtime: "nodejs",
};

const ALLOWED_CONTENT_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/webm",
  "audio/ogg",
  "audio/flac",
  "audio/x-flac",
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/quicktime",
]);

const MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024; // 500 MB

async function getAudioUploadUrl(transcriptId: number): Promise<string> {
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
      },
    }),
    { expiresIn: PRESIGNED_URL_TTL }
  );

  return formatUrl(uploadRequest);
}

async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const auth = getAuth(req);
  if (!auth.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const meetingId = req.query.id as string;
  if (!meetingId) {
    res.status(400).json({ error: "Meeting ID is required" });
    return;
  }

  const body = req.body || {};
  const { orgId, userId } = await resolveRequestContext(auth.userId, body.orgId, req.headers);

  if (!orgId) {
    res.status(400).json({ error: "Organization context required" });
    return;
  }

  const conn = getPortalDbConnection();

  // Phase 2: transcriptId provided → link to meeting and trigger diarization
  if (body.transcriptId !== undefined) {
    const transcriptId = Number(body.transcriptId);
    if (!transcriptId) {
      res.status(400).json({ error: "Invalid transcriptId" });
      return;
    }

    // Verify the meeting exists and belongs to this org
    const meetingCheck = await conn.execute(
      "SELECT id FROM gc_meetings WHERE id = ? AND org_id = ?",
      [meetingId, orgId]
    );
    if (meetingCheck.rows.length === 0) {
      res.status(404).json({ error: "Meeting not found" });
      return;
    }

    // Verify the transcript belongs to this org/user, and get language for diarization
    const transcriptCheck = await conn.execute(
      "SELECT id, language FROM transcripts WHERE id = ? AND org_id = ?",
      [transcriptId, orgId]
    );
    if (transcriptCheck.rows.length === 0) {
      res.status(404).json({ error: "Transcript not found" });
      return;
    }
    const transcriptLanguage =
      (transcriptCheck.rows[0] as { id: number; language: string | null }).language ?? undefined;

    await linkMinutesToMeeting(conn, meetingId, orgId, transcriptId);

    try {
      await triggerAudioDiarization(transcriptId, transcriptLanguage);
    } catch (pipelineError) {
      console.error("[upload-audio] Audio pipeline start failed:", pipelineError);
    }

    res.status(200).json({ success: true, transcriptId });
    return;
  }

  // Phase 1: create transcript record and return presigned upload URL
  const { fileName, contentType, language, fileSize } = body as {
    fileName?: string;
    contentType?: string;
    language?: string;
    fileSize?: number;
  };

  if (!fileName) {
    res.status(400).json({ error: "fileName is required" });
    return;
  }

  if (!contentType || !ALLOWED_CONTENT_TYPES.has(contentType)) {
    res.status(400).json({
      error: `Unsupported file type: ${contentType}. Allowed types: mp3, wav, m4a, mp4, webm, ogg, flac`,
    });
    return;
  }

  if (fileSize !== undefined && fileSize > MAX_FILE_SIZE_BYTES) {
    res.status(400).json({ error: "File size exceeds the 500 MB limit" });
    return;
  }

  // Verify the meeting exists and does not already have minutes
  const meetingCheck = await conn.execute(
    "SELECT id, title, minutes_transcript_id FROM gc_meetings WHERE id = ? AND org_id = ?",
    [meetingId, orgId]
  );

  if (meetingCheck.rows.length === 0) {
    res.status(404).json({ error: "Meeting not found" });
    return;
  }

  const meeting = meetingCheck.rows[0] as {
    id: number;
    title: string;
    minutes_transcript_id: number | null;
  };

  if (meeting.minutes_transcript_id) {
    res.status(200).json({
      transcriptId: meeting.minutes_transcript_id,
      alreadyExists: true,
    });
    return;
  }

  const title = `${meeting.title} - Minutes`;
  const transcriptId = await createAudioMinutesTranscript(conn, userId, orgId, title, language);

  const uploadUrl = await getAudioUploadUrl(transcriptId);

  res.status(200).json({ transcriptId, uploadUrl });
}

export default withErrorReporting(handler);
