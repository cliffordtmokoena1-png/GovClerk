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
import {
  DEFAULT_REGION,
  getTranscriptBucketNameByRegion,
  getUploadKey,
  type Region,
} from "@/utils/s3";
import { PRESIGNED_URL_TTL } from "@/common/constants";
import { isDev } from "@/utils/dev";

export const config = {
  runtime: "nodejs",
};

async function getTranscriptFromS3(transcriptId: number, region: Region): Promise<string> {
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
      headers: {
        host: bucketHost,
      },
    }),
    { expiresIn: PRESIGNED_URL_TTL }
  );

  const downloadUrl = formatUrl(getRequest);
  const response = await fetch(downloadUrl);

  if (!response.ok) {
    throw new Error(`Failed to fetch transcript from S3: ${response.status}`);
  }

  return response.text();
}

type DiarizedSegment = {
  speaker: string;
  start: string;
  stop: string;
  transcript: string | null;
};

function formatDiarizedSegments(segments: DiarizedSegment[]): string {
  return segments
    .filter((s) => s.transcript)
    .map((s) => `${s.speaker} [${s.start}]: ${s.transcript}`)
    .join("\n");
}

async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== "GET") {
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

  const orgIdParam = req.query.orgId as string;
  const { orgId } = await resolveRequestContext(auth.userId, orgIdParam, req.headers);
  if (!orgId) {
    res.status(400).json({ error: "Organization context required" });
    return;
  }

  const conn = getPortalDbConnection();

  try {
    const meetingResult = await conn.execute(
      "SELECT minutes_transcript_id FROM gc_meetings WHERE id = ? AND org_id = ?",
      [meetingId, orgId]
    );

    if (meetingResult.rows.length === 0) {
      res.status(404).json({ error: "Meeting not found" });
      return;
    }

    const meeting = meetingResult.rows[0] as { minutes_transcript_id: number | null };
    if (!meeting.minutes_transcript_id) {
      res.status(404).json({ error: "No minutes transcript linked to this meeting" });
      return;
    }

    const transcriptId = meeting.minutes_transcript_id;

    const transcriptResult = await conn.execute(
      "SELECT aws_region, upload_kind FROM transcripts WHERE id = ?",
      [transcriptId]
    );

    if (transcriptResult.rows.length === 0) {
      res.status(404).json({ error: "Transcript not found" });
      return;
    }

    const transcript = transcriptResult.rows[0] as { aws_region: string; upload_kind: string };

    let transcriptText: string;

    if (transcript.upload_kind === "text") {
      transcriptText = await getTranscriptFromS3(
        transcriptId,
        (transcript.aws_region as Region) || DEFAULT_REGION
      );
    } else {
      // Audio upload - reconstruct from diarized segments
      const segmentResult = await conn.execute(
        `SELECT speaker, start, stop, transcript FROM gc_segments 
         WHERE transcript_id = ? AND is_user_visible = 1 AND fast_mode = 0
         ORDER BY CAST(start AS TIME)`,
        [transcriptId]
      );

      if (segmentResult.rows.length === 0) {
        // Fallback to fast_mode segments
        const fastResult = await conn.execute(
          `SELECT speaker, start, stop, transcript FROM gc_segments 
           WHERE transcript_id = ? AND fast_mode = 1
           ORDER BY CAST(start AS TIME)`,
          [transcriptId]
        );

        if (fastResult.rows.length === 0) {
          res.status(404).json({ error: "No transcript segments found" });
          return;
        }

        transcriptText = formatDiarizedSegments(fastResult.rows as DiarizedSegment[]);
      } else {
        transcriptText = formatDiarizedSegments(segmentResult.rows as DiarizedSegment[]);
      }
    }

    res.status(200).json({
      transcriptId,
      text: transcriptText,
    });
  } catch (error) {
    console.error("[get-transcript] Error:", error);
    res.status(500).json({
      error: `Failed to fetch transcript: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
}

export default withErrorReporting(handler);
