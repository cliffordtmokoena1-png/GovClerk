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
import { DEFAULT_REGION, getTranscriptBucketNameByRegion } from "@/utils/s3";
import { PRESIGNED_URL_TTL } from "@/common/constants";

export const config = {
  runtime: "nodejs",
};

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
    const result = await conn.execute(
      `SELECT r.s3_key, r.duration_ms 
       FROM gc_broadcast_recordings r
       JOIN gc_broadcasts b ON r.broadcast_id = b.id
       WHERE b.meeting_id = ? AND b.org_id = ? AND r.status = 'completed' AND r.s3_key IS NOT NULL
       ORDER BY r.created_at DESC LIMIT 1`,
      [meetingId, orgId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: "No recording found" });
      return;
    }

    const recording = result.rows[0] as { s3_key: string; duration_ms: number | null };

    const region = DEFAULT_REGION;
    const bucket = getTranscriptBucketNameByRegion(region);
    const bucketHost = `${bucket}.s3.${region}.amazonaws.com`;

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
        path: `/${recording.s3_key}`,
        headers: {
          host: bucketHost,
        },
      }),
      { expiresIn: PRESIGNED_URL_TTL }
    );

    const url = formatUrl(getRequest);

    res.status(200).json({
      url,
      durationMs: recording.duration_ms,
    });
  } catch (error) {
    console.error("[recording-url] Error:", error);
    res.status(500).json({ error: "Failed to get recording URL" });
  }
}

export default withErrorReporting(handler);
