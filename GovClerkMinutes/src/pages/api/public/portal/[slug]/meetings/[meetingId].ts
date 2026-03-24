import withErrorReporting from "@/error/withErrorReporting";
import { connect } from "@planetscale/database";
import { NextRequest } from "next/server";
import type { PublicMeetingResponse, PortalArtifact, PortalArtifactType } from "@/types/portal";

export const config = {
  runtime: "edge",
};

function getConnection() {
  return connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });
}

async function handler(req: NextRequest): Promise<Response> {
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/");
  // Path: /api/public/portal/[slug]/meetings/[meetingId]
  const slugIndex = pathParts.indexOf("portal") + 1;
  const slug = pathParts[slugIndex];
  const meetingId = pathParts[pathParts.length - 1];

  if (!slug) {
    return new Response(JSON.stringify({ error: "Portal slug is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!meetingId) {
    return new Response(JSON.stringify({ error: "Meeting ID is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const conn = getConnection();

  // Verify the portal exists and is enabled
  const portalResult = await conn.execute(
    "SELECT id, org_id FROM gc_portal_settings WHERE slug = ? AND is_enabled = true",
    [slug]
  );

  if (portalResult.rows.length === 0) {
    return new Response(JSON.stringify({ error: "Portal not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const portalSettings = portalResult.rows[0] as any;
  const orgId = portalSettings.org_id;

  // Get the meeting
  const meetingResult = await conn.execute(
    `SELECT id, title, description, meeting_date, tags, is_cancelled
     FROM gc_meetings
     WHERE id = ? AND org_id = ? AND is_public = true`,
    [meetingId, orgId]
  );

  if (meetingResult.rows.length === 0) {
    return new Response(JSON.stringify({ error: "Meeting not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const meeting = meetingResult.rows[0] as any;

  // Fetch artifacts for this meeting
  const artifactsResult = await conn.execute(
    `SELECT id, org_id, meeting_id, artifact_type, file_name, file_size,
            content_type, s3_key, s3_url, is_public, source_transcript_id,
            source_agenda_id, version, created_at, updated_at
     FROM gc_artifacts
     WHERE meeting_id = ? AND is_public = 1`,
    [meetingId]
  );

  const artifacts: PortalArtifact[] = (artifactsResult.rows as any[]).map((row) => ({
    id: row.id,
    orgId: row.org_id,
    portalMeetingId: row.meeting_id,
    artifactType: row.artifact_type as PortalArtifactType,
    fileName: row.file_name,
    fileSize: row.file_size,
    contentType: row.content_type,
    s3Key: row.s3_key,
    s3Url: row.s3_url,
    isPublic: Boolean(row.is_public),
    sourceTranscriptId: row.source_transcript_id,
    sourceAgendaId: row.source_agenda_id,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  // Parse tags
  let tags: string[] | undefined;
  if (meeting.tags) {
    try {
      tags = typeof meeting.tags === "string" ? JSON.parse(meeting.tags) : meeting.tags;
    } catch {
      tags = undefined;
    }
  }

  const response: PublicMeetingResponse = {
    meeting: {
      id: meeting.id,
      title: meeting.title,
      description: meeting.description,
      meetingDate: meeting.meeting_date,
      tags,
      isCancelled: Boolean(meeting.is_cancelled),
      artifacts,
    },
  };

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

export default withErrorReporting(handler);
