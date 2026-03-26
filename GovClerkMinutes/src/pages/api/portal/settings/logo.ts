import { getAuth } from "@clerk/nextjs/server";
import type { NextApiRequest, NextApiResponse } from "next";
import { S3RequestPresigner } from "@aws-sdk/s3-request-presigner";
import { Hash } from "@aws-sdk/hash-node";
import { formatUrl } from "@aws-sdk/util-format-url";
import { HttpRequest } from "@smithy/protocol-http";
import { v4 as uuidv4 } from "uuid";
import path from "node:path";

import withErrorReporting from "@/error/withErrorReporting";
import { assertString } from "@/utils/assert";
import { PRESIGNED_URL_TTL } from "@/common/constants";
import { resolveRequestContext } from "@/utils/resolveRequestContext";
import { getPortalDbConnection } from "@/utils/portalDb";

// Public bucket for portal logos (same bucket used by crawler)
const PUBLIC_BUCKET = "govclerk-bucket";
const PUBLIC_BUCKET_REGION = "us-east-1";

type LogoUploadRequestBody = {
  fileName: string;
  fileSize: number;
  contentType?: string;
  orgId?: string;
  settingsId: string;
};

type LogoUploadResponseBody = {
  uploadUrl: string;
  logoUrl: string;
};

const VALID_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

function resolveExtension(fileName: string, contentType?: string): string {
  const extFromName = path.extname(fileName ?? "").toLowerCase();
  if (extFromName) {
    return extFromName;
  }

  const typeMapping: Record<string, string> = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "image/svg+xml": ".svg",
  };

  if (contentType && typeMapping[contentType]) {
    return typeMapping[contentType];
  }

  return ".png";
}

function getContentType(fileName: string, providedType?: string): string {
  if (providedType && VALID_IMAGE_TYPES.includes(providedType)) {
    return providedType;
  }

  const ext = path.extname(fileName).toLowerCase();
  const extToContentType: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
  };

  return extToContentType[ext] || "image/png";
}

async function logoHandler(
  req: NextApiRequest,
  res: NextApiResponse<LogoUploadResponseBody | { error: string }>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { userId } = getAuth(req);
  if (userId == null) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const body = (
    typeof req.body === "string" ? JSON.parse(req.body) : req.body
  ) as LogoUploadRequestBody;

  const { fileName, fileSize, contentType: providedContentType, settingsId } = body;

  if (!fileName || typeof fileName !== "string") {
    return res.status(400).json({ error: "fileName is required" });
  }

  if (!fileSize || typeof fileSize !== "number" || fileSize <= 0) {
    return res.status(400).json({ error: "fileSize must be a positive number" });
  }

  if (fileSize > MAX_FILE_SIZE) {
    return res.status(400).json({ error: "File size exceeds 5MB limit" });
  }

  if (!settingsId || typeof settingsId !== "string") {
    return res.status(400).json({ error: "settingsId is required" });
  }

  const contentType = getContentType(fileName, providedContentType);
  if (!VALID_IMAGE_TYPES.includes(contentType)) {
    return res.status(400).json({
      error: "Invalid file type. Must be one of: png, jpg, jpeg, gif, webp, svg",
    });
  }

  const { orgId } = await resolveRequestContext(userId, body.orgId, req.headers);
  if (!orgId) {
    return res.status(400).json({ error: "Organization context required" });
  }

  const conn = getPortalDbConnection();

  // Verify settings belong to org
  const settingsResult = await conn.execute(
    "SELECT id FROM gc_portal_settings WHERE id = ? AND org_id = ?",
    [settingsId, orgId]
  );

  if (settingsResult.rows.length === 0) {
    return res.status(404).json({ error: "Portal settings not found" });
  }

  const logoId = uuidv4();
  const extension = resolveExtension(fileName, contentType);
  const s3Key = `portal/logos/${orgId}/${logoId}${extension}`;

  const bucketHost = `${PUBLIC_BUCKET}.s3.${PUBLIC_BUCKET_REGION}.amazonaws.com`;
  const logoUrl = `https://${bucketHost}/${s3Key}`;

  const presigner = new S3RequestPresigner({
    credentials: {
      accessKeyId: assertString(process.env.AWS_ACCESS_KEY_ID),
      secretAccessKey: assertString(process.env.AWS_SECRET_ACCESS_KEY),
    },
    region: PUBLIC_BUCKET_REGION,
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
        "content-type": contentType,
      },
    }),
    { expiresIn: PRESIGNED_URL_TTL }
  );

  const uploadUrl = formatUrl(uploadRequest);

  // Update gc_portal_settings with the new logo URL
  await conn.execute("UPDATE gc_portal_settings SET logo_url = ? WHERE id = ? AND org_id = ?", [
    logoUrl,
    settingsId,
    orgId,
  ]);

  return res.status(200).json({ uploadUrl, logoUrl });
}

export default withErrorReporting(logoHandler);
