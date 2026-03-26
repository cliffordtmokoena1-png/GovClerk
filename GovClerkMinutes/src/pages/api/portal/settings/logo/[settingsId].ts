import withErrorReporting from "@/error/withErrorReporting";
import type { NextApiRequest, NextApiResponse } from "next";
import { S3RequestPresigner } from "@aws-sdk/s3-request-presigner";
import { Hash } from "@aws-sdk/hash-node";
import { formatUrl } from "@aws-sdk/util-format-url";
import { HttpRequest } from "@smithy/protocol-http";
import { assertString } from "@/utils/assert";
import { getPortalDbConnection } from "@/utils/portalDb";

export const config = {
  runtime: "nodejs",
};

// Same bucket used for logo uploads
const PUBLIC_BUCKET = "govclerk-bucket";
const PUBLIC_BUCKET_REGION = "us-east-1";
const DOWNLOAD_URL_TTL = 3600; // 1 hour

function extractS3KeyFromUrl(logoUrl: string): string | null {
  try {
    const url = new URL(logoUrl);
    // URL format: https://bucket.s3.region.amazonaws.com/path/to/file
    // or https://s3.region.amazonaws.com/bucket/path/to/file
    const pathname = url.pathname;
    // Remove leading slash
    return pathname.startsWith("/") ? pathname.slice(1) : pathname;
  } catch {
    return null;
  }
}

async function generatePresignedUrl(s3Key: string): Promise<string> {
  const bucketHost = `${PUBLIC_BUCKET}.s3.${PUBLIC_BUCKET_REGION}.amazonaws.com`;

  const presigner = new S3RequestPresigner({
    credentials: {
      accessKeyId: assertString(process.env.AWS_ACCESS_KEY_ID),
      secretAccessKey: assertString(process.env.AWS_SECRET_ACCESS_KEY),
    },
    region: PUBLIC_BUCKET_REGION,
    sha256: Hash.bind(null, "sha256"),
  });

  const request = await presigner.presign(
    new HttpRequest({
      protocol: "https",
      hostname: bucketHost,
      method: "GET",
      path: `/${s3Key}`,
      headers: {
        host: bucketHost,
      },
    }),
    { expiresIn: DOWNLOAD_URL_TTL }
  );

  return formatUrl(request);
}

async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  // Get settingsId from dynamic route params
  const { settingsId } = req.query as { settingsId: string };

  if (!settingsId) {
    res.status(400).json({ error: "Settings ID is required" });
    return;
  }

  const conn = getPortalDbConnection();

  // Fetch the portal settings to get logo_url
  const result = await conn.execute("SELECT id, logo_url FROM gc_portal_settings WHERE id = ?", [
    settingsId,
  ]);

  if (result.rows.length === 0) {
    res.status(404).json({ error: "Portal settings not found" });
    return;
  }

  const settings = result.rows[0] as {
    id: string;
    logo_url: string | null;
  };

  if (!settings.logo_url) {
    res.status(404).json({ error: "No logo configured" });
    return;
  }

  // Check if logo URL is from our S3 bucket (needs presigning)
  const isOurBucket = settings.logo_url.includes(PUBLIC_BUCKET);

  if (!isOurBucket) {
    // External URL, redirect directly
    res.redirect(302, settings.logo_url);
    return;
  }

  // Extract S3 key and generate presigned URL
  const s3Key = extractS3KeyFromUrl(settings.logo_url);

  if (!s3Key) {
    res.status(500).json({ error: "Invalid logo URL format" });
    return;
  }

  const presignedUrl = await generatePresignedUrl(s3Key);
  res.redirect(302, presignedUrl);
}

export default withErrorReporting(handler);
