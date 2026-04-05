import withErrorReporting from "@/error/withErrorReporting";
import { getAuth } from "@clerk/nextjs/server";
import type { NextApiRequest, NextApiResponse } from "next";
import { resolveRequestContext } from "@/utils/resolveRequestContext";
import { S3RequestPresigner } from "@aws-sdk/s3-request-presigner";
import { Hash } from "@aws-sdk/hash-node";
import { formatUrl } from "@aws-sdk/util-format-url";
import { HttpRequest } from "@smithy/protocol-http";
import { getTranscriptBucketNameByRegion, DEFAULT_REGION, type Region } from "@/utils/s3";
import { assertString } from "@/utils/assert";
import { PRESIGNED_URL_TTL } from "@/common/constants";
import { errorResponse, jsonResponse } from "@/utils/apiHelpers";
import { getPortalDbConnection } from "@/utils/portalDb";
import type { PortalArtifact } from "@/types/portal";
import { serverUri } from "@/utils/server";
import { distributeAgendaToOrgMembers } from "@/utils/portalEmails";

export const config = {
  runtime: "nodejs",
};

async function getAgendaUploadUrl(
  orgId: string,
  meetingId: string,
  fileSize: number,
  region: Region
): Promise<{ uploadUrl: string; s3Key: string; s3Url: string }> {
  const bucket = getTranscriptBucketNameByRegion(region);
  const bucketHost = `${bucket}.s3.${region}.amazonaws.com`;
  const timestamp = Date.now();
  const s3Key = `portal/${orgId}/${meetingId}/agenda_pdf_${timestamp}.pdf`;
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

async function createAgendaArtifact(
  conn: any,
  orgId: string,
  meetingId: string,
  portalSettingsId: number,
  fileName: string,
  fileSize: number,
  s3Key: string,
  s3Url: string
): Promise<number> {
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");

  const insertResult = await conn.execute(
    `INSERT INTO gc_artifacts (
      org_id, portal_settings_id, meeting_id, artifact_type, file_name, file_size,
      content_type, s3_key, s3_url, is_public, version, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      orgId,
      portalSettingsId,
      meetingId,
      "agenda_pdf",
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

function generateAgendaMarkdown(meetingTitle: string, meetingDate: string, tree: any[]): string {
  const lines: string[] = [];

  lines.push(`# ${meetingTitle}`);
  lines.push("");
  lines.push("## AGENDA");
  lines.push("");
  lines.push(
    `**Date:** ${new Date(meetingDate).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })}`
  );
  lines.push("");
  lines.push("---");
  lines.push("");

  // Helper functions for numbering
  function toRoman(num: number): string {
    const romanNumerals: [number, string][] = [
      [1000, "M"],
      [900, "CM"],
      [500, "D"],
      [400, "CD"],
      [100, "C"],
      [90, "XC"],
      [50, "L"],
      [40, "XL"],
      [10, "X"],
      [9, "IX"],
      [5, "V"],
      [4, "IV"],
      [1, "I"],
    ];
    let result = "";
    for (const [value, symbol] of romanNumerals) {
      while (num >= value) {
        result += symbol;
        num -= value;
      }
    }
    return result;
  }

  function toLetter(num: number, lowercase: boolean): string {
    const letter = String.fromCharCode(64 + num);
    return lowercase ? letter.toLowerCase() : letter;
  }

  function getItemPrefix(level: number, index: number): string {
    const num = index + 1;
    switch (level) {
      case 0:
        return `${toRoman(num)}.`;
      case 1:
        return `${toLetter(num, false)}.`;
      case 2:
        return `${num}.`;
      case 3:
        return `${toLetter(num, true)}.`;
      case 4:
        return `(${num})`;
      default:
        return `${num}.`;
    }
  }

  // Render agenda items
  const renderItem = (item: any, level: number, index: number) => {
    const indent = "  ".repeat(level);
    const prefix = getItemPrefix(level, index);

    lines.push(`${indent}**${prefix}** ${item.title}`);

    if (item.description) {
      lines.push("");
      const descLines = item.description.split("\n");
      for (const line of descLines) {
        lines.push(`${indent}> ${line}`);
      }
    }

    lines.push("");

    if (item.children && item.children.length > 0) {
      item.children.forEach((child: any, childIndex: number) => {
        renderItem(child, level + 1, childIndex);
      });
    }
  };

  tree.forEach((item, index) => {
    renderItem(item, 0, index);
  });

  return lines.join("\n");
}

async function handlePost(
  id: string,
  orgId: string,
  body: { meetingTitle: string; meetingDate: string; tree: any[] }
): Promise<Response> {
  const { meetingTitle, meetingDate, tree } = body;

  if (!meetingTitle || typeof meetingTitle !== "string") {
    return errorResponse("meetingTitle is required", 400);
  }

  if (!meetingDate || typeof meetingDate !== "string") {
    return errorResponse("meetingDate is required", 400);
  }

  if (!tree || !Array.isArray(tree)) {
    return errorResponse("tree is required", 400);
  }

  const conn = getPortalDbConnection();

  // Verify meeting exists and get portal settings ID
  const meetingResult = await conn.execute(
    "SELECT id, portal_settings_id, title, meeting_date FROM gc_meetings WHERE id = ? AND org_id = ?",
    [id, orgId]
  );

  if (meetingResult.rows.length === 0) {
    return errorResponse("Meeting not found", 404);
  }

  const meeting = meetingResult.rows[0] as {
    id: number;
    portal_settings_id: number;
    title: string;
    meeting_date: string;
  };
  const portalSettingsId = meeting.portal_settings_id;

  try {
    // Step 1: Generate agenda markdown
    const markdownContent = generateAgendaMarkdown(meetingTitle, meetingDate, tree);

    // Step 2: Convert markdown to PDF using convert document API on the Rust server
    const form = new FormData();
    form.append("file", new Blob([markdownContent], { type: "text/markdown" }), "agenda.md");
    form.append("output_type", "pdf");
    form.append("input_type", "gfm");

    const convertResponse = await fetch(serverUri("/api/convert-document"), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.UPLOAD_COMPLETE_WEBHOOK_SECRET}`,
      },
      body: form,
    });

    if (!convertResponse.ok) {
      const errorText = await convertResponse.text();
      throw new Error(`Failed to convert agenda to PDF: ${convertResponse.status} - ${errorText}`);
    }

    const pdfBytes = await convertResponse.arrayBuffer();
    const pdfBlob = new Uint8Array(pdfBytes);

    // Step 3: Upload PDF to S3 (use default region for new uploads)
    const region: Region = DEFAULT_REGION;
    const { uploadUrl, s3Key, s3Url } = await getAgendaUploadUrl(orgId, id, pdfBlob.length, region);

    await uploadPdfToS3(uploadUrl, pdfBlob);

    // Step 4: Create artifact record
    const fileName = `${meetingTitle.replace(/[^a-zA-Z0-9]/g, "_")}_Agenda.pdf`;
    const artifactId = await createAgendaArtifact(
      conn,
      orgId,
      id,
      portalSettingsId,
      fileName,
      pdfBlob.length,
      s3Key,
      s3Url
    );

    // Step 5: Generate presigned download URL
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
        hostname: `${getTranscriptBucketNameByRegion(region)}.s3.${region}.amazonaws.com`,
        method: "GET",
        path: `/${s3Key}`,
      }),
      { expiresIn: PRESIGNED_URL_TTL }
    );

    const downloadUrl = formatUrl(getRequest);

    // Return the created artifact and download URL
    const artifact: PortalArtifact = {
      id: artifactId,
      orgId,
      portalSettingsId,
      portalMeetingId: Number(id),
      artifactType: "agenda_pdf" as const,
      fileName,
      fileSize: pdfBlob.length,
      contentType: "application/pdf",
      s3Key,
      s3Url,
      isPublic: false,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Step 6: Distribute agenda notifications to all org members (fire-and-forget)
    (async () => {
      try {
        const settingsResult = await conn.execute(
          "SELECT slug, page_title FROM gc_portal_settings WHERE id = ?",
          [portalSettingsId]
        );
        if (settingsResult.rows.length > 0) {
          const settings = settingsResult.rows[0] as { slug: string; page_title: string | null };
          const orgName = settings.page_title || orgId;
          await distributeAgendaToOrgMembers(
            orgId,
            orgName,
            settings.slug,
            id,
            meeting.title || meetingTitle,
            meeting.meeting_date || meetingDate
          );
        }
      } catch (distErr) {
        console.error("[export-agenda] Failed to distribute agenda notifications:", distErr);
      }
    })();

    return jsonResponse({
      success: true,
      artifact,
      downloadUrl,
    });
  } catch (error) {
    console.error("Error exporting agenda:", error);
    return errorResponse(
      `Failed to export agenda: ${error instanceof Error ? error.message : "Unknown error"}`,
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
    console.error("Export handler error:", error);
    res.status(500).json({
      error: `Export failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
}

export default withErrorReporting(handler);
