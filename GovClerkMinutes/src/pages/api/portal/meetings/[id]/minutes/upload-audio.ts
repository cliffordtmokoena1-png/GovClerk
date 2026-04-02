import withErrorReporting from "@/error/withErrorReporting";
import { getAuth } from "@clerk/nextjs/server";
import type { NextApiRequest, NextApiResponse } from "next";
import { resolveRequestContext } from "@/utils/resolveRequestContext";
import { getPortalDbConnection } from "@/utils/portalDb";
import { S3Client, CreateMultipartUploadCommand, CompleteMultipartUploadCommand, UploadPartCommand } from "@aws-sdk/client-s3";
import { S3RequestPresigner } from "@aws-sdk/s3-request-presigner";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
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

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB

/** Files larger than this threshold are uploaded using S3 multipart upload. */
const MULTIPART_THRESHOLD_BYTES = 100 * 1024 * 1024; // 100 MB
/** Size of each multipart upload part (min 5 MB required by S3; we use 50 MB). */
const PART_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

function makeS3Client(region: string): S3Client {
  return new S3Client({
    region,
    credentials: {
      accessKeyId: assertString(process.env.AWS_ACCESS_KEY_ID),
      secretAccessKey: assertString(process.env.AWS_SECRET_ACCESS_KEY),
    },
  });
}

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

/** Creates an S3 multipart upload and returns presigned URLs for each part. */
async function initMultipartUpload(
  transcriptId: number,
  fileSize: number
): Promise<{ uploadId: string; partSize: number; parts: Array<{ partNumber: number; url: string }> }> {
  const region = DEFAULT_REGION;
  const bucket = getTranscriptBucketNameByRegion(region);
  const s3Key = getUploadKey(transcriptId, { env: isDev() ? "dev" : "prod" });
  const s3Client = makeS3Client(region);

  const createResult = await s3Client.send(
    new CreateMultipartUploadCommand({ Bucket: bucket, Key: s3Key })
  );
  const uploadId = assertString(createResult.UploadId);

  const numParts = Math.ceil(fileSize / PART_SIZE_BYTES);
  const parts = await Promise.all(
    Array.from({ length: numParts }, async (_, i) => {
      const partNumber = i + 1;
      const url = await getSignedUrl(
        s3Client,
        new UploadPartCommand({
          Bucket: bucket,
          Key: s3Key,
          UploadId: uploadId,
          PartNumber: partNumber,
        }),
        { expiresIn: PRESIGNED_URL_TTL }
      );
      return { partNumber, url };
    })
  );

  return { uploadId, partSize: PART_SIZE_BYTES, parts };
}

/** Completes an S3 multipart upload. */
async function completeMultipartUpload(
  transcriptId: number,
  uploadId: string,
  parts: Array<{ partNumber: number; etag: string }>
): Promise<void> {
  const region = DEFAULT_REGION;
  const bucket = getTranscriptBucketNameByRegion(region);
  const s3Key = getUploadKey(transcriptId, { env: isDev() ? "dev" : "prod" });
  const s3Client = makeS3Client(region);

  await s3Client.send(
    new CompleteMultipartUploadCommand({
      Bucket: bucket,
      Key: s3Key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts.map((p) => ({ PartNumber: p.partNumber, ETag: p.etag })),
      },
    })
  );
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

  // Phase 2.5: Complete a multipart upload
  if (body.action === "complete-multipart") {
    const { transcriptId: rawTranscriptId, uploadId, parts } = body as {
      transcriptId?: number;
      uploadId?: string;
      parts?: Array<{ partNumber: number; etag: string }>;
    };

    const transcriptId = Number(rawTranscriptId);
    if (!transcriptId || !uploadId || !Array.isArray(parts) || parts.length === 0) {
      res.status(400).json({ error: "transcriptId, uploadId, and parts are required" });
      return;
    }

    // Verify the transcript belongs to this org
    const transcriptCheck = await conn.execute(
      "SELECT id FROM transcripts WHERE id = ? AND org_id = ?",
      [transcriptId, orgId]
    );
    if (transcriptCheck.rows.length === 0) {
      res.status(404).json({ error: "Transcript not found" });
      return;
    }

    await completeMultipartUpload(transcriptId, uploadId, parts);
    res.status(200).json({ success: true });
    return;
  }

  // Retry diarization: reset failed flag and re-trigger diarization on the existing audio
  if (body.action === "retry-diarization") {
    const transcriptId = Number(body.transcriptId);
    if (!transcriptId) {
      res.status(400).json({ error: "transcriptId is required" });
      return;
    }

    const transcriptCheck = await conn.execute(
      "SELECT id, language FROM transcripts WHERE id = ? AND org_id = ?",
      [transcriptId, orgId]
    );
    if (transcriptCheck.rows.length === 0) {
      res.status(404).json({ error: "Transcript not found" });
      return;
    }

    // Reset failure flag so the frontend polling can reflect the new attempt
    await conn.execute(
      "UPDATE transcripts SET transcribe_failed = 0 WHERE id = ?",
      [transcriptId]
    );

    const transcriptLanguage =
      (transcriptCheck.rows[0] as { id: number; language: string | null }).language ?? undefined;
    try {
      await triggerAudioDiarization(transcriptId, transcriptLanguage);
    } catch (pipelineError) {
      console.error("[upload-audio] Retry diarization failed:", pipelineError);
      res.status(500).json({ error: "Failed to retry transcription" });
      return;
    }

    res.status(200).json({ success: true });
    return;
  }

  // Phase 3: transcriptId provided → link to meeting and trigger diarization
  if (body.transcriptId !== undefined && body.action === undefined) {
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

  // Phase 1: create transcript record and return presigned upload URL (or multipart credentials)
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
    res.status(400).json({ error: "File size exceeds the 2 GB limit" });
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

  // For large files, use S3 multipart upload instead of a single presigned PUT
  if (fileSize !== undefined && fileSize > MULTIPART_THRESHOLD_BYTES) {
    const multipartUpload = await initMultipartUpload(transcriptId, fileSize);
    res.status(200).json({ transcriptId, multipartUpload });
    return;
  }

  const uploadUrl = await getAudioUploadUrl(transcriptId);
  res.status(200).json({ transcriptId, uploadUrl });
}

export default withErrorReporting(handler);
