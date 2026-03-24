import withErrorReporting from "@/error/withErrorReporting";
import { getAuth } from "@clerk/nextjs/server";
import type { Connection } from "@planetscale/database";
import type { NextApiRequest, NextApiResponse } from "next";
import { resolveRequestContext } from "@/utils/resolveRequestContext";
import { S3RequestPresigner } from "@aws-sdk/s3-request-presigner";
import { Hash } from "@aws-sdk/hash-node";
import { formatUrl } from "@aws-sdk/util-format-url";
import { HttpRequest } from "@smithy/protocol-http";
import {
  getTranscriptBucketNameByRegion,
  extractRegionFromS3Url,
  DEFAULT_REGION,
  type Region,
} from "@/utils/s3";
import { assertString } from "@/utils/assert";
import { PRESIGNED_URL_TTL } from "@/common/constants";
import { PDFDocument } from "pdf-lib";
import { errorResponse, jsonResponse } from "@/utils/apiHelpers";
import { formatMySQLDateTime } from "@/utils/dbQueries";
import { getPortalDbConnection } from "@/utils/portalDb";

// Rust server URL for document conversion
const RUST_SERVER_URL =
  process.env.RUST_SERVER_URL ||
  (process.env.NODE_ENV === "production"
    ? "https://server.GovClerkMinutes.com"
    : "http://127.0.0.1:8000");

// Supported convertible file types and their input format identifiers
const CONVERTIBLE_MIME_TYPES: Record<string, string> = {
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/markdown": "gfm",
  "text/plain": "plain",
  "text/x-markdown": "gfm",
};

const CONVERTIBLE_EXTENSIONS: Record<string, string> = {
  ".docx": "docx",
  ".md": "gfm",
  ".markdown": "gfm",
  ".txt": "plain",
};

function isPdfArtifact(artifact: { content_type: string; file_name: string }): boolean {
  return (
    artifact.content_type === "application/pdf" || artifact.file_name.toLowerCase().endsWith(".pdf")
  );
}

function getInputFormat(artifact: { content_type: string; file_name: string }): string | null {
  // Check mime type first
  if (artifact.content_type && CONVERTIBLE_MIME_TYPES[artifact.content_type]) {
    return CONVERTIBLE_MIME_TYPES[artifact.content_type];
  }

  // Fall back to file extension
  const fileName = artifact.file_name.toLowerCase();
  for (const [ext, format] of Object.entries(CONVERTIBLE_EXTENSIONS)) {
    if (fileName.endsWith(ext)) {
      return format;
    }
  }

  return null;
}

function isConvertibleArtifact(artifact: { content_type: string; file_name: string }): boolean {
  return getInputFormat(artifact) !== null;
}

async function fetchFileFromS3(s3Key: string, region: Region): Promise<ArrayBuffer> {
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
      path: `/${s3Key}`,
    }),
    { expiresIn: PRESIGNED_URL_TTL }
  );

  const getUrl = formatUrl(getRequest);

  const response = await fetch(getUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch file from S3: ${response.status}`);
  }

  return await response.arrayBuffer();
}

async function convertToPdf(
  fileBuffer: ArrayBuffer,
  inputFormat: string,
  fileName: string
): Promise<ArrayBuffer> {
  const formData = new FormData();
  formData.append("file", new Blob([fileBuffer]), fileName);
  formData.append("output_type", "pdf");
  formData.append("input_type", inputFormat);

  const response = await fetch(`${RUST_SERVER_URL}/api/convert-document`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(`Document conversion failed (${response.status}): ${errorText}`);
  }

  return await response.arrayBuffer();
}

async function getPdfBuffer(
  artifact: { id: number; s3_key: string; file_name: string; content_type: string },
  region: Region
): Promise<{ buffer: ArrayBuffer; wasConverted: boolean }> {
  const fileBuffer = await fetchFileFromS3(artifact.s3_key, region);

  // If already PDF, return as-is
  if (isPdfArtifact(artifact)) {
    return { buffer: fileBuffer, wasConverted: false };
  }

  // Get input format for conversion
  const inputFormat = getInputFormat(artifact);
  if (!inputFormat) {
    throw new Error(
      `Unsupported file type for conversion: ${artifact.content_type} (${artifact.file_name})`
    );
  }

  // Convert to PDF
  const pdfBuffer = await convertToPdf(fileBuffer, inputFormat, artifact.file_name);
  return { buffer: pdfBuffer, wasConverted: true };
}

async function getPacketUploadUrl(
  orgId: string,
  meetingId: string,
  fileSize: number,
  region: Region
): Promise<{ uploadUrl: string; s3Key: string; s3Url: string }> {
  const bucket = getTranscriptBucketNameByRegion(region);
  const bucketHost = `${bucket}.s3.${region}.amazonaws.com`;
  const timestamp = Date.now();
  const s3Key = `portal/${orgId}/${meetingId}/minutes_packet_${timestamp}.pdf`;
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
        "content-type": "application/pdf",
      },
    }),
    { expiresIn: PRESIGNED_URL_TTL }
  );

  const uploadUrl = formatUrl(uploadRequest);
  return { uploadUrl, s3Key, s3Url };
}

async function createPacketArtifact(
  conn: Connection,
  orgId: string,
  meetingId: string,
  portalSettingsId: number,
  fileName: string,
  fileSize: number,
  s3Key: string,
  s3Url: string
): Promise<number> {
  const now = formatMySQLDateTime();

  const insertResult = await conn.execute(
    `INSERT INTO gc_artifacts (
      org_id, portal_settings_id, meeting_id, artifact_type, file_name, file_size,
      content_type, s3_key, s3_url, is_public, version, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      orgId,
      portalSettingsId,
      meetingId,
      "minutes_packet",
      fileName,
      fileSize,
      "application/pdf",
      s3Key,
      s3Url,
      false,
      1,
      now,
      now,
    ]
  );

  return Number(insertResult.insertId);
}

async function createPacketItemRelationships(
  conn: Connection,
  packetArtifactId: number,
  orderedArtifactIds: number[]
): Promise<void> {
  const now = formatMySQLDateTime();
  const insertPromises = orderedArtifactIds.map((artifactId, index) =>
    conn.execute(
      `INSERT INTO gc_artifact_packet_items (artifact_packet_id, artifact_item_id, ordinal, created_at)
       VALUES (?, ?, ?, ?)`,
      [packetArtifactId, artifactId, index + 1, now]
    )
  );

  await Promise.all(insertPromises);
}

async function uploadPdfToS3(uploadUrl: string, pdfBytes: Uint8Array): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "application/pdf",
    },
    body: Buffer.from(pdfBytes),
  });

  if (!response.ok) {
    throw new Error(`Failed to upload PDF: ${response.status}`);
  }
}

async function handlePost(
  id: string,
  orgId: string,
  body: { artifactIds: number[]; orderedIds: number[] }
): Promise<Response> {
  const { artifactIds, orderedIds } = body;

  if (!artifactIds || !Array.isArray(artifactIds) || artifactIds.length === 0) {
    return errorResponse("At least one artifact ID is required", 400);
  }

  if (!orderedIds || !Array.isArray(orderedIds) || orderedIds.length === 0) {
    return errorResponse("Ordered IDs array is required", 400);
  }

  if (artifactIds.length !== orderedIds.length) {
    return errorResponse("Artifact IDs and ordered IDs must have same length", 400);
  }

  const conn = getPortalDbConnection();

  // Verify meeting exists and get portal settings ID
  const meetingResult = await conn.execute(
    "SELECT id, portal_settings_id FROM gc_meetings WHERE id = ? AND org_id = ?",
    [id, orgId]
  );

  if (meetingResult.rows.length === 0) {
    return errorResponse("Meeting not found", 404);
  }

  const meeting = meetingResult.rows[0] as { id: number; portal_settings_id: number };
  const portalSettingsId = meeting.portal_settings_id;

  // Fetch artifact details for the selected documents
  const placeholders = artifactIds.map(() => "?").join(",");
  const artifactsResult = await conn.execute(
    `SELECT id, s3_key, s3_url, file_name, content_type
     FROM gc_artifacts
     WHERE id IN (${placeholders}) AND org_id = ? AND meeting_id = ?`,
    [...artifactIds, orgId, id]
  );

  const artifacts = artifactsResult.rows as Array<{
    id: number;
    s3_key: string;
    s3_url: string;
    file_name: string;
    content_type: string;
  }>;

  if (artifacts.length === 0) {
    return errorResponse("No valid artifacts found", 404);
  }

  // Categorize artifacts: PDF, convertible, or unsupported
  const unsupportedArtifacts = artifacts.filter(
    (artifact) => !isPdfArtifact(artifact) && !isConvertibleArtifact(artifact)
  );

  if (unsupportedArtifacts.length > 0) {
    const unsupportedNames = unsupportedArtifacts.map((a) => a.file_name).join(", ");
    return errorResponse(
      `${unsupportedArtifacts.length} document(s) cannot be converted to PDF: ${unsupportedNames}. ` +
        "Supported formats: PDF, DOCX, Markdown (.md), and plain text (.txt).",
      400
    );
  }

  try {
    // Fetch and convert documents as needed, maintaining order
    const pdfDocs: Array<{ doc: PDFDocument; id: number }> = [];
    const conversionResults: Array<{ id: number; converted: boolean; error?: string }> = [];

    // Order artifacts according to the user's specified order
    const orderedArtifacts = orderedIds
      .map((id) => artifacts.find((artifact) => artifact.id === id))
      .filter(Boolean);

    for (const artifact of orderedArtifacts) {
      if (!artifact) {
        continue;
      }

      try {
        // Extract region from artifact's s3_url, fallback to default
        const artifactRegion = extractRegionFromS3Url(artifact.s3_url) || DEFAULT_REGION;
        const { buffer: pdfBytes, wasConverted } = await getPdfBuffer(artifact, artifactRegion);
        const pdfDoc = await PDFDocument.load(pdfBytes);
        pdfDocs.push({ doc: pdfDoc, id: artifact.id });
        conversionResults.push({ id: artifact.id, converted: wasConverted });
      } catch (conversionError) {
        const errorMessage =
          conversionError instanceof Error ? conversionError.message : "Unknown error";
        console.error(
          `Failed to process artifact ${artifact.id} (${artifact.file_name}):`,
          errorMessage
        );
        conversionResults.push({ id: artifact.id, converted: false, error: errorMessage });
        // Continue processing other documents - skip failed ones
      }
    }

    if (pdfDocs.length === 0) {
      return errorResponse("No PDF documents could be loaded", 400);
    }

    // Create a new PDF document and merge all pages
    const mergedPdf = await PDFDocument.create();
    let totalPageCount = 0;

    for (const { doc } of pdfDocs) {
      const pages = await mergedPdf.copyPages(doc, doc.getPageIndices());
      totalPageCount += pages.length;
      for (const page of pages) {
        mergedPdf.addPage(page);
      }
    }

    const mergedPdfBytes = await mergedPdf.save();

    // Upload the merged PDF to S3 (use default region for new uploads)
    const { uploadUrl, s3Key, s3Url } = await getPacketUploadUrl(
      orgId,
      id,
      mergedPdfBytes.length,
      DEFAULT_REGION
    );

    await uploadPdfToS3(uploadUrl, mergedPdfBytes);

    // Create packet artifact record
    const packetFileName = `Meeting Packet - ${new Date().toLocaleDateString()}.pdf`;
    const packetArtifactId = await createPacketArtifact(
      conn,
      orgId,
      id,
      portalSettingsId,
      packetFileName,
      mergedPdfBytes.length,
      s3Key,
      s3Url
    );

    // Create packet-item relationships
    await createPacketItemRelationships(conn, packetArtifactId, orderedIds);

    // Return the created packet artifact
    const packetArtifact = {
      id: packetArtifactId,
      orgId,
      portalSettingsId,
      portalMeetingId: Number(id),
      artifactType: "minutes_packet" as const,
      fileName: packetFileName,
      fileSize: mergedPdfBytes.length,
      contentType: "application/pdf",
      s3Key,
      s3Url,
      isPublic: false,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Include conversion statistics in response
    const convertedCount = conversionResults.filter((r) => r.converted).length;
    const failedConversions = conversionResults.filter((r) => r.error);

    return jsonResponse({
      success: true,
      packet: packetArtifact,
      mergedPageCount: totalPageCount,
      documentCount: pdfDocs.length,
      conversionStats: {
        converted: convertedCount,
        failed: failedConversions.length,
        failedDocuments: failedConversions.map((f) => ({
          id: f.id,
          error: f.error,
        })),
      },
    });
  } catch (error) {
    console.error("Error creating packet:", error);
    return errorResponse(
      `Failed to create packet: ${error instanceof Error ? error.message : "Unknown error"}`,
      500
    );
  }
}

async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  const auth = getAuth(req);
  if (!auth.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const id = req.query.id as string;

  if (!id) {
    res.status(400).json({ error: "Meeting ID is required" });
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const body = req.body || {};
  const orgIdParam = body.orgId;

  const { orgId } = await resolveRequestContext(auth.userId, orgIdParam, req.headers);

  if (!orgId) {
    res.status(400).json({ error: "Organization context required" });
    return;
  }

  try {
    const response = await handlePost(id, orgId, body);
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error("Packet handler error:", error);
    res.status(500).json({
      error: `Failed to create packet: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
}

export default withErrorReporting(handler);
