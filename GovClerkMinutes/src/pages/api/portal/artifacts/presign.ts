import { getAuth } from "@clerk/nextjs/server";
import type { NextApiRequest, NextApiResponse } from "next";
import { S3RequestPresigner } from "@aws-sdk/s3-request-presigner";
import { Hash } from "@aws-sdk/hash-node";
import { formatUrl } from "@aws-sdk/util-format-url";
import { HttpRequest } from "@smithy/protocol-http";

import withErrorReporting from "@/error/withErrorReporting";
import { assertString } from "@/utils/assert";
import { getTranscriptBucketNameByRegion, type Region, assertRegion } from "@/utils/s3";
import { PRESIGNED_URL_TTL } from "@/common/constants";
import { resolveRequestContext } from "@/utils/resolveRequestContext";
import { getPortalDbConnection } from "@/utils/portalDb";
import type { PortalArtifactType, PortalArtifact } from "@/types/portal";

function getExtname(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  return lastDot > 0 ? filename.slice(lastDot) : "";
}

type PresignRequestBody = {
  meetingId: string;
  artifactType: PortalArtifactType;
  fileName: string;
  fileSize: number;
  contentType?: string;
  region?: Region | null;
  orgId?: string;
};

type PresignResponseBody = {
  artifact: PortalArtifact;
  uploadUrl: string;
};

const DEFAULT_REGION: Region = "us-east-1";

const VALID_ARTIFACT_TYPES: PortalArtifactType[] = [
  "agenda_pdf",
  "agenda_packet",
  "minutes_pdf",
  "minutes_packet",
  "meeting_recording",
  "recordings",
  "other",
];

function resolveExtension(fileName: string, contentType?: string): string {
  const extFromName = getExtname(fileName ?? "").toLowerCase();
  if (extFromName) {
    return extFromName;
  }

  const typeMapping: Record<string, string> = {
    "application/pdf": ".pdf",
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "audio/mpeg": ".mp3",
    "audio/mp4": ".m4a",
    "application/zip": ".zip",
  };

  if (contentType && typeMapping[contentType]) {
    return typeMapping[contentType];
  }

  return "";
}

function getContentTypeForArtifact(artifactType: PortalArtifactType, fileName: string): string {
  const ext = getExtname(fileName).toLowerCase();

  const extToContentType: Record<string, string> = {
    ".pdf": "application/pdf",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mp3": "audio/mpeg",
    ".m4a": "audio/mp4",
    ".zip": "application/zip",
  };

  return extToContentType[ext] || "application/octet-stream";
}

async function presignHandler(
  req: NextApiRequest,
  res: NextApiResponse<PresignResponseBody | { error: string }>
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
  ) as PresignRequestBody;

  const { meetingId, artifactType, fileName, fileSize, contentType: providedContentType } = body;

  if (!meetingId || typeof meetingId !== "string") {
    return res.status(400).json({ error: "meetingId is required" });
  }

  if (!artifactType || !VALID_ARTIFACT_TYPES.includes(artifactType)) {
    return res
      .status(400)
      .json({ error: `Invalid artifactType. Must be one of: ${VALID_ARTIFACT_TYPES.join(", ")}` });
  }

  if (!fileName || typeof fileName !== "string") {
    return res.status(400).json({ error: "fileName is required" });
  }

  if (!fileSize || typeof fileSize !== "number" || fileSize <= 0) {
    return res.status(400).json({ error: "fileSize must be a positive number" });
  }

  const { orgId } = await resolveRequestContext(userId, body.orgId, req.headers);
  if (!orgId) {
    return res.status(400).json({ error: "Organization context required" });
  }

  const region: Region = body.region ? assertRegion(body.region) : DEFAULT_REGION;
  const conn = getPortalDbConnection();

  const meetingResult = await conn.execute(
    "SELECT id, portal_settings_id FROM gc_meetings WHERE id = ? AND org_id = ?",
    [meetingId, orgId]
  );

  if (meetingResult.rows.length === 0) {
    return res.status(404).json({ error: "Meeting not found" });
  }

  const meeting = meetingResult.rows[0] as { id: number; portal_settings_id: number };
  const mgPortalSettingsId = meeting.portal_settings_id;

  const extension = resolveExtension(fileName, providedContentType);
  const contentType = providedContentType || getContentTypeForArtifact(artifactType, fileName);
  // Use a timestamp for s3Key uniqueness since we won't have the ID until after insert
  const timestamp = Date.now();
  const s3Key = `portal/${orgId}/${meetingId}/${artifactType}_${timestamp}${extension}`;

  const bucket = getTranscriptBucketNameByRegion(region);
  const bucketHost = `${bucket}.s3.${region}.amazonaws.com`;
  const s3Url = `https://${bucketHost}/${s3Key}`;

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
        "content-type": contentType,
      },
    }),
    { expiresIn: PRESIGNED_URL_TTL }
  );

  const uploadUrl = formatUrl(uploadRequest);

  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  const insertResult = await conn.execute(
    `INSERT INTO gc_artifacts (
      org_id, portal_settings_id, meeting_id, artifact_type, file_name, file_size,
      content_type, s3_key, s3_url, is_public, version, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      orgId,
      mgPortalSettingsId,
      meetingId,
      artifactType,
      fileName,
      fileSize,
      contentType,
      s3Key,
      s3Url,
      false,
      1,
      now,
      now,
    ]
  );

  // PlanetScale returns insertId as string
  const artifactId = Number(insertResult.insertId);

  const artifact: PortalArtifact = {
    id: artifactId,
    orgId,
    portalSettingsId: mgPortalSettingsId,
    portalMeetingId: Number(meetingId),
    artifactType: artifactType,
    fileName,
    fileSize,
    contentType,
    s3Key,
    s3Url,
    isPublic: false,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };

  return res.status(200).json({ artifact, uploadUrl });
}

export default withErrorReporting(presignHandler);
