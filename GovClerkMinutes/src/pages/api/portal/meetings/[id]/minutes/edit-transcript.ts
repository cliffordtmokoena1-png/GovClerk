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

export const config = {
  runtime: "nodejs",
};

type EditSegment = {
  index: number;
  text: string;
  speaker?: string;
};

async function fetchTranscriptFromS3(transcriptId: number, region: string): Promise<string> {
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

  const getRequest = await presigner.presign(
    new HttpRequest({
      protocol: "https",
      hostname: bucketHost,
      method: "GET",
      path: `/${s3Key}`,
      headers: { host: bucketHost },
    }),
    { expiresIn: PRESIGNED_URL_TTL }
  );

  const response = await fetch(formatUrl(getRequest));
  if (!response.ok) {
    throw new Error(`Failed to fetch transcript from S3: ${response.status}`);
  }
  return response.text();
}

async function uploadTranscriptToS3(
  transcriptId: number,
  text: string,
  region: string
): Promise<void> {
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

  const response = await fetch(formatUrl(uploadRequest), {
    method: "PUT",
    body: Buffer.from(text, "utf-8"),
    headers: { "content-type": "text/plain; charset=utf-8" },
  });

  if (!response.ok) {
    throw new Error(`Failed to upload transcript to S3: ${response.status}`);
  }
}

async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== "PUT") {
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
  const { orgId } = await resolveRequestContext(auth.userId, body.orgId, req.headers);

  if (!orgId) {
    res.status(400).json({ error: "Organization context required" });
    return;
  }

  const segments: EditSegment[] = body.segments;
  if (!Array.isArray(segments) || segments.length === 0) {
    res.status(400).json({ error: "segments array is required" });
    return;
  }

  const conn = getPortalDbConnection();

  // Verify meeting exists and get the transcript ID
  const meetingResult = await conn.execute(
    "SELECT minutes_transcript_id FROM gc_meetings WHERE id = ? AND org_id = ?",
    [meetingId, orgId]
  );

  if (meetingResult.rows.length === 0) {
    res.status(404).json({ error: "Meeting not found" });
    return;
  }

  const transcriptId = (meetingResult.rows[0] as { minutes_transcript_id: number | null })
    .minutes_transcript_id;

  if (!transcriptId) {
    res.status(400).json({ error: "Meeting has no transcript" });
    return;
  }

  // Get transcript region
  const transcriptResult = await conn.execute(
    "SELECT aws_region FROM transcripts WHERE id = ? AND org_id = ?",
    [transcriptId, orgId]
  );

  if (transcriptResult.rows.length === 0) {
    res.status(404).json({ error: "Transcript not found" });
    return;
  }

  const region = (transcriptResult.rows[0] as { aws_region: string }).aws_region || DEFAULT_REGION;

  // Fetch current transcript text from S3
  const transcriptText = await fetchTranscriptFromS3(transcriptId, region);

  // Parse transcript lines
  const lines = transcriptText.split("\n");

  // Apply edits: each segment has an index (0-based line index) and new text/speaker
  for (const edit of segments) {
    if (edit.index < 0 || edit.index >= lines.length) {
      continue;
    }
    const currentLine = lines[edit.index];
    // Determine the speaker prefix for this line
    const colonIdx = currentLine.indexOf(": ");
    const currentSpeaker = colonIdx !== -1 ? currentLine.substring(0, colonIdx) : null;
    const speaker = edit.speaker ?? currentSpeaker ?? "Speaker";
    lines[edit.index] = `${speaker}: ${edit.text}`;
  }

  const updatedText = lines.join("\n");

  // Upload modified transcript back to S3
  await uploadTranscriptToS3(transcriptId, updatedText, region);

  res.status(200).json({ success: true });
}

export default withErrorReporting(handler);
