import withErrorReporting from "@/error/withErrorReporting";
import { getAuth } from "@clerk/nextjs/server";
import type { NextApiRequest, NextApiResponse } from "next";
import { S3RequestPresigner } from "@aws-sdk/s3-request-presigner";
import { Hash } from "@aws-sdk/hash-node";
import { formatUrl } from "@aws-sdk/util-format-url";
import { HttpRequest } from "@smithy/protocol-http";
import { assertString } from "@/utils/assert";
import { resolveRequestContext } from "@/utils/resolveRequestContext";
import {
  getTranscriptBucketNameByRegion,
  extractRegionFromS3Url,
  DEFAULT_REGION,
  type Region,
} from "@/utils/s3";
import { getPortalDbConnection } from "@/utils/portalDb";

export const config = {
  runtime: "nodejs",
};

const DOWNLOAD_URL_TTL = 3600; // 1 hour

async function generatePresignedDownloadUrl(
  s3Key: string,
  fileName: string,
  region: Region
): Promise<string> {
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

  const downloadRequest = await presigner.presign(
    new HttpRequest({
      protocol: "https",
      hostname: bucketHost,
      method: "GET",
      path: `/${s3Key}`,
      headers: {
        host: bucketHost,
      },
      query: {
        "response-content-disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
      },
    }),
    { expiresIn: DOWNLOAD_URL_TTL }
  );

  return formatUrl(downloadRequest);
}

async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  // Get artifactId and orgId from query params
  const { artifactId, orgId: orgIdParam } = req.query as { artifactId: string; orgId?: string };

  if (!artifactId) {
    res.status(400).json({ error: "Artifact ID is required" });
    return;
  }

  const conn = getPortalDbConnection();

  // Fetch the artifact
  const artifactResult = await conn.execute(
    `SELECT id, org_id, s3_key, s3_url, file_name, is_public
    FROM gc_artifacts WHERE id = ?`,
    [artifactId]
  );

  if (artifactResult.rows.length === 0) {
    res.status(404).json({ error: "Artifact not found" });
    return;
  }

  const artifact = artifactResult.rows[0] as {
    id: string;
    org_id: string;
    s3_key: string;
    s3_url: string;
    file_name: string;
    is_public: number;
  };

  const isPublic = Boolean(artifact.is_public);

  // Determine the region from the stored s3_url, falling back to default
  const region = extractRegionFromS3Url(artifact.s3_url) || DEFAULT_REGION;

  // If artifact is public, generate presigned URL and redirect (no auth required)
  if (isPublic) {
    const downloadUrl = await generatePresignedDownloadUrl(
      artifact.s3_key,
      artifact.file_name,
      region
    );
    res.redirect(302, downloadUrl);
    return;
  }

  // Artifact is private - require authentication
  const auth = getAuth(req);
  if (!auth.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // Verify user belongs to the org that owns this artifact
  const { orgId } = await resolveRequestContext(auth.userId, orgIdParam, req.headers);

  if (!orgId || orgId !== artifact.org_id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  // User is authenticated and authorized - generate presigned URL
  const downloadUrl = await generatePresignedDownloadUrl(
    artifact.s3_key,
    artifact.file_name,
    region
  );
  res.redirect(302, downloadUrl);
}

export default withErrorReporting(handler);
