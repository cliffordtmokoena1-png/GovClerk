import withErrorReporting from "@/error/withErrorReporting";
import { getAuth } from "@clerk/nextjs/server";
import type { NextApiRequest, NextApiResponse } from "next";
import { resolveRequestContext } from "@/utils/resolveRequestContext";
import { getPortalDbConnection } from "@/utils/portalDb";
import { serverUri } from "@/utils/server";
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
import { convertDateForMysql } from "@/utils/date";
import type { PortalArtifactType } from "@/types/portal";
import type { Connection } from "@planetscale/database";
import { getSpeakerMap, substituteSpeakerLabels } from "@/utils/speakers";
import {
  createProgressOperation,
  updateProgress,
  completeOperation,
  failOperation,
} from "@/utils/progressDb";

export const config = {
  runtime: "nodejs",
};

async function getArtifactUploadUrl(
  orgId: string,
  meetingId: string,
  contentType: string,
  extension: string,
  artifactPrefix: string,
  region: Region
) {
  const timestamp = Date.now();
  const s3Key = `portal/${orgId}/meetings/${meetingId}/${artifactPrefix}_${timestamp}.${extension}`;
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
  return { uploadUrl, s3Key, s3Url };
}

async function createArtifact(
  conn: Connection,
  orgId: string,
  meetingId: string,
  portalSettingsId: number,
  artifactType: PortalArtifactType,
  fileName: string,
  fileSize: number,
  contentType: string,
  s3Key: string,
  s3Url: string,
  transcriptId: number,
  version: number
): Promise<number> {
  const now = convertDateForMysql(new Date());

  const insertResult = await conn.execute(
    `INSERT INTO gc_artifacts (
      org_id, portal_settings_id, meeting_id, artifact_type, file_name, file_size,
      content_type, s3_key, s3_url, is_public, source_transcript_id, version, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      orgId,
      portalSettingsId,
      meetingId,
      artifactType,
      fileName,
      fileSize,
      contentType,
      s3Key,
      s3Url,
      false,
      transcriptId,
      version,
      now,
      now,
    ]
  );

  return Number(insertResult.insertId);
}

async function uploadToS3(
  uploadUrl: string,
  fileBytes: Uint8Array,
  contentType: string
): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
    },
    body: Buffer.from(fileBytes),
  });

  if (!response.ok) {
    throw new Error(`Failed to upload to S3: ${response.status}`);
  }
}

async function verifyMeetingExistsAndGetDetails(
  conn: Connection,
  meetingId: string,
  orgId: string
) {
  const meetingResult = await conn.execute(
    "SELECT id, portal_settings_id, title, minutes_transcript_id FROM gc_meetings WHERE id = ? AND org_id = ?",
    [meetingId, orgId]
  );

  if (meetingResult.rows.length === 0) {
    return null;
  }

  return meetingResult.rows[0] as {
    id: number;
    portal_settings_id: number;
    title: string;
    minutes_transcript_id: number | null;
  };
}

async function checkForExistingArtifacts(
  conn: Connection,
  orgId: string,
  meetingId: string,
  transcriptId: number,
  artifactTypes: PortalArtifactType[],
  version?: number
) {
  const placeholders = artifactTypes.map(() => "?").join(", ");
  const versionClause = version !== undefined ? " AND version = ?" : "";
  const params =
    version !== undefined
      ? [orgId, meetingId, transcriptId, ...artifactTypes, version]
      : [orgId, meetingId, transcriptId, ...artifactTypes];

  const existingArtifactsResult = await conn.execute(
    `SELECT artifact_type FROM gc_artifacts 
     WHERE org_id = ? AND meeting_id = ? AND source_transcript_id = ? 
     AND artifact_type IN (${placeholders})${versionClause}`,
    params
  );

  const existingTypes = new Set(
    (existingArtifactsResult.rows as Array<{ artifact_type: string }>).map(
      (row) => row.artifact_type
    )
  );
  return existingTypes;
}

async function fetchMinutesContent(
  conn: Connection,
  transcriptId: number,
  orgId: string,
  version?: number
): Promise<string | null> {
  const query =
    version !== undefined
      ? `SELECT minutes FROM minutes 
       WHERE transcript_id = ? AND org_id = ? AND fast_mode = 0 AND version = ?
       LIMIT 1`
      : `SELECT minutes FROM minutes 
       WHERE transcript_id = ? AND org_id = ? AND fast_mode = 0
       ORDER BY version DESC LIMIT 1`;

  const params = version !== undefined ? [transcriptId, orgId, version] : [transcriptId, orgId];

  const minutesResult = await conn.execute(query, params);

  if (minutesResult.rows.length === 0 || !minutesResult.rows[0].minutes) {
    return null;
  }

  return minutesResult.rows[0].minutes as string;
}

async function fetchTranscriptFromS3(transcriptId: number, region: Region): Promise<string> {
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

type DocumentOutputType = "pdf" | "docx";

async function convertDocument(
  content: string,
  outputType: DocumentOutputType,
  fileName: string
): Promise<Uint8Array> {
  console.info(
    `[convertDocument] outputType=${outputType} fileName=${fileName} contentLength=${content.length} serverUri=${serverUri("/api/convert-document")}`
  );

  const sanitized = sanitizeForConversion(content);
  const form = new FormData();
  form.append("file", new Blob([sanitized], { type: "text/markdown" }), fileName);
  form.append("output_type", outputType);
  form.append("input_type", "gfm");

  const response = await fetch(serverUri("/api/convert-document"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.UPLOAD_COMPLETE_WEBHOOK_SECRET}`,
    },
    body: form,
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "(no body)");
    console.error(`[convertDocument] failed: status=${response.status} body=${errorBody}`);
    throw new Error(`Failed to convert to ${outputType.toUpperCase()}: ${response.status}`);
  }

  return new Uint8Array(await response.arrayBuffer());
}

function createTranscriptMarkdown(text: string, title: string): string {
  return `# ${title}\n\n## Transcript\n\n${text}`;
}

function formatTimestampForFileName(date: Date): string {
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const month = months[date.getMonth()];
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${month}-${day}-${year}-${hours}-${minutes}-${seconds}`;
}

// Strip characters that break LaTeX/pandoc: control chars, replacement char (U+FFFD),
// and other non-printable Unicode (surrogates, BOM, interlinear annotation, object replacement).
function sanitizeForConversion(content: string): string {
  return content.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\uFFFD\uFEFF\uFFF9-\uFFFB\uFFFC]/g, "");
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
  const { orgId } = await resolveRequestContext(auth.userId, body.orgId, req.headers);
  if (!orgId) {
    res.status(400).json({ error: "Organization context required" });
    return;
  }

  const requestedVersion: number | undefined =
    body.version !== undefined ? Number(body.version) : undefined;

  const conn = getPortalDbConnection();

  const meeting = await verifyMeetingExistsAndGetDetails(conn, meetingId, orgId);
  if (!meeting) {
    res.status(404).json({ error: "Meeting not found" });
    return;
  }

  const {
    portal_settings_id: portalSettingsId,
    title: meetingTitle,
    minutes_transcript_id: transcriptId,
  } = meeting;

  if (!transcriptId) {
    res.status(400).json({ error: "No minutes transcript linked to this meeting" });
    return;
  }

  const existingTypes = await checkForExistingArtifacts(conn, orgId, meetingId, transcriptId, [
    "minutes",
    "transcripts",
  ]);

  const isExplicitSave = requestedVersion !== undefined;

  if (!isExplicitSave && existingTypes.has("minutes") && existingTypes.has("transcripts")) {
    res.status(200).json({ success: true, alreadyExists: true });
    return;
  }

  const artifactVersion = requestedVersion ?? 1;
  const versionSuffix = artifactVersion > 1 ? `_v${artifactVersion}` : "";
  const timestamp = formatTimestampForFileName(new Date());

  let progressOpId: number | null = null;

  try {
    progressOpId = await createProgressOperation(Number(meetingId), "minutes_export");
  } catch (progressError) {
    console.error("[generate-artifacts] Failed to create progress operation:", progressError);
  }

  const region: Region = DEFAULT_REGION;
  const sanitizedTitle = meetingTitle.replace(/[^a-zA-Z0-9]/g, "_");
  const artifacts: Record<
    string,
    { id: number; fileName: string; fileSize: number; artifactType: string }
  > = {};

  try {
    if (isExplicitSave || !existingTypes.has("minutes")) {
      const rawMinutesMarkdown = await fetchMinutesContent(
        conn,
        transcriptId,
        orgId,
        requestedVersion
      );

      if (rawMinutesMarkdown) {
        const speakerMap = await getSpeakerMap(transcriptId, conn);
        const minutesMarkdown =
          substituteSpeakerLabels(rawMinutesMarkdown, speakerMap) ?? rawMinutesMarkdown;

        if (progressOpId) {
          try {
            await updateProgress(progressOpId, 25);
          } catch (progressError) {
            console.error("[generate-artifacts] Failed to update progress at 25%:", progressError);
          }
        }

        const [docxBytes, pdfBytes] = await Promise.all([
          convertDocument(minutesMarkdown, "docx", "minutes.md"),
          convertDocument(minutesMarkdown, "pdf", "minutes.md"),
        ]);
        const docxFileName = `${sanitizedTitle}_Minutes${versionSuffix}_${timestamp}.docx`;
        const pdfFileName = `${sanitizedTitle}_Minutes${versionSuffix}_${timestamp}.pdf`;
        const [docxUploadDetails, pdfUploadDetails] = await Promise.all([
          getArtifactUploadUrl(
            orgId,
            meetingId,
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "docx",
            "minutes",
            region
          ),
          getArtifactUploadUrl(orgId, meetingId, "application/pdf", "pdf", "minutes_pdf", region),
        ]);
        await Promise.all([
          uploadToS3(
            docxUploadDetails.uploadUrl,
            docxBytes,
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          ),
          uploadToS3(pdfUploadDetails.uploadUrl, pdfBytes, "application/pdf"),
        ]);
        const [docxArtifactId, pdfArtifactId] = await Promise.all([
          createArtifact(
            conn,
            orgId,
            meetingId,
            portalSettingsId,
            "minutes",
            docxFileName,
            docxBytes.length,
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            docxUploadDetails.s3Key,
            docxUploadDetails.s3Url,
            transcriptId,
            artifactVersion
          ),
          createArtifact(
            conn,
            orgId,
            meetingId,
            portalSettingsId,
            "minutes_pdf",
            pdfFileName,
            pdfBytes.length,
            "application/pdf",
            pdfUploadDetails.s3Key,
            pdfUploadDetails.s3Url,
            transcriptId,
            artifactVersion
          ),
        ]);
        artifacts.minutesDocx = {
          id: docxArtifactId,
          fileName: docxFileName,
          fileSize: docxBytes.length,
          artifactType: "minutes",
        };
        artifacts.minutesPdf = {
          id: pdfArtifactId,
          fileName: pdfFileName,
          fileSize: pdfBytes.length,
          artifactType: "minutes_pdf",
        };
      }
    }

    if (progressOpId) {
      try {
        await updateProgress(progressOpId, 50);
      } catch (progressError) {
        console.error("[generate-artifacts] Failed to update progress at 50%:", progressError);
      }
    }

    if (!existingTypes.has("transcripts")) {
      const transcriptResult = await conn.execute(
        "SELECT aws_region FROM transcripts WHERE id = ?",
        [transcriptId]
      );

      if (transcriptResult.rows.length > 0) {
        const transcriptRegion =
          (transcriptResult.rows[0] as { aws_region: string }).aws_region || DEFAULT_REGION;
        const transcriptText = await fetchTranscriptFromS3(
          transcriptId,
          transcriptRegion as Region
        );

        const transcriptMarkdown = createTranscriptMarkdown(transcriptText, meetingTitle);

        const transcriptDocxBytes = await convertDocument(
          transcriptMarkdown,
          "docx",
          "transcript.md"
        );
        const transcriptDocxFileName = `${sanitizedTitle}_Transcript.docx`;
        const transcriptDocxUploadDetails = await getArtifactUploadUrl(
          orgId,
          meetingId,
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "docx",
          "transcript",
          region
        );
        await uploadToS3(
          transcriptDocxUploadDetails.uploadUrl,
          transcriptDocxBytes,
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        );
        const transcriptDocxArtifactId = await createArtifact(
          conn,
          orgId,
          meetingId,
          portalSettingsId,
          "transcripts",
          transcriptDocxFileName,
          transcriptDocxBytes.length,
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          transcriptDocxUploadDetails.s3Key,
          transcriptDocxUploadDetails.s3Url,
          transcriptId,
          1
        );
        artifacts.transcriptDocx = {
          id: transcriptDocxArtifactId,
          fileName: transcriptDocxFileName,
          fileSize: transcriptDocxBytes.length,
          artifactType: "transcripts",
        };
      }
    }

    if (progressOpId) {
      try {
        await updateProgress(progressOpId, 80);
      } catch (progressError) {
        console.error("[generate-artifacts] Failed to update progress at 80%:", progressError);
      }
    }

    if (progressOpId) {
      try {
        await completeOperation(progressOpId);
      } catch (progressError) {
        console.error("[generate-artifacts] Failed to complete progress operation:", progressError);
      }
    }

    res.status(200).json({
      success: true,
      artifacts,
    });
  } catch (error) {
    if (progressOpId) {
      try {
        await failOperation(progressOpId, error instanceof Error ? error.message : "Unknown error");
      } catch (progressError) {
        console.error("[generate-artifacts] Failed to fail progress operation:", progressError);
      }
    }

    console.error("Error generating artifacts:", error);
    res.status(500).json({
      error: `Failed to generate artifacts: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
}

export default withErrorReporting(handler);
