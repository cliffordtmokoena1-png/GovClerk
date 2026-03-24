import withErrorReporting from "@/error/withErrorReporting";
import { connect } from "@planetscale/database";
import { NextRequest } from "next/server";
import { serverUri } from "@/utils/server";
import { getSpeakerMap, substituteSpeakerLabels } from "@/utils/speakers";

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
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/");
  // Path: /api/public/portal/[slug]/meetings/[meetingId]/export
  const slugIndex = pathParts.indexOf("portal") + 1;
  const slug = pathParts[slugIndex];
  const meetingId = pathParts[pathParts.length - 2]; // meetingId is before "export"

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

  let body: { type: "minutes" | "agenda"; version?: number; format?: "pdf" | "docx" };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON in request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { type, version, format = "pdf" } = body;

  if (!type || !["minutes", "agenda"].includes(type)) {
    return new Response(
      JSON.stringify({ error: "Invalid document type. Must be 'minutes' or 'agenda'" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
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
    `SELECT id, title, minutes_transcript_id, minutes_version, agenda_id, agenda_version
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
  let content: string | null = null;
  let title = meeting.title || "Document";

  if (type === "minutes") {
    if (!meeting.minutes_transcript_id) {
      return new Response(JSON.stringify({ error: "No minutes linked to this meeting" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Fetch the minutes content
    const targetVersion = version ?? meeting.minutes_version;
    let minutesQuery: string;
    let minutesParams: any[];

    if (targetVersion) {
      minutesQuery = `SELECT minutes as content FROM minutes 
                      WHERE transcript_id = ? AND version = ? AND fast_mode = 0 AND minutes IS NOT NULL`;
      minutesParams = [meeting.minutes_transcript_id, targetVersion];
    } else {
      // Get the latest version
      minutesQuery = `SELECT minutes as content FROM minutes 
                      WHERE transcript_id = ? AND fast_mode = 0 AND minutes IS NOT NULL 
                      ORDER BY version DESC LIMIT 1`;
      minutesParams = [meeting.minutes_transcript_id];
    }

    const minutesResult = await conn.execute(minutesQuery, minutesParams);
    if (minutesResult.rows.length === 0) {
      return new Response(JSON.stringify({ error: "Minutes content not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    content = (minutesResult.rows[0] as any).content;

    if (content) {
      const speakerMap = await getSpeakerMap(meeting.minutes_transcript_id, conn);
      content = substituteSpeakerLabels(content, speakerMap) ?? content;
    }

    title = `${title} - Minutes`;
  } else {
    // agenda
    if (!meeting.agenda_id) {
      return new Response(JSON.stringify({ error: "No agenda linked to this meeting" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Fetch the agenda content
    const targetVersion = version ?? meeting.agenda_version;
    let agendaQuery: string;
    let agendaParams: any[];

    if (targetVersion) {
      agendaQuery = `SELECT content FROM agendas 
                     WHERE series_id = ? AND version = ? AND status = 'generated' AND content IS NOT NULL`;
      agendaParams = [meeting.agenda_id, targetVersion];
    } else {
      // Get the latest version
      agendaQuery = `SELECT content FROM agendas 
                     WHERE series_id = ? AND status = 'generated' AND content IS NOT NULL 
                     ORDER BY version DESC LIMIT 1`;
      agendaParams = [meeting.agenda_id];
    }

    const agendaResult = await conn.execute(agendaQuery, agendaParams);
    if (agendaResult.rows.length === 0) {
      return new Response(JSON.stringify({ error: "Agenda content not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    content = (agendaResult.rows[0] as any).content;
    title = `${title} - Agenda`;
  }

  if (!content) {
    return new Response(JSON.stringify({ error: "Document content is empty" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Convert to PDF/DOCX using the Rust backend
  try {
    const form = new FormData();
    form.append("file", new Blob([content], { type: "text/markdown" }), "document.md");
    form.append("output_type", format);
    form.append("input_type", "gfm");

    const convertResponse = await fetch(serverUri("/api/convert-document"), {
      method: "POST",
      body: form,
    });

    if (!convertResponse.ok) {
      const errorText = await convertResponse.text();
      console.error("Document conversion failed:", errorText);
      return new Response(JSON.stringify({ error: "Failed to convert document" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const blob = await convertResponse.blob();
    const contentType =
      format === "pdf"
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    const extension = format === "pdf" ? "pdf" : "docx";
    const filename = `${title.replace(/[^a-zA-Z0-9\s-]/g, "").replace(/\s+/g, "_")}.${extension}`;

    return new Response(blob, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return new Response(JSON.stringify({ error: "Failed to export document" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export default withErrorReporting(handler);
