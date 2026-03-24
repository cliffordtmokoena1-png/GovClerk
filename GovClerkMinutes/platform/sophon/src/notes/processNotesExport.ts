import { getDb } from "../db.ts";
import { putObject } from "../s3.ts";
import { getBroadcastForExport, getMeetingForExport } from "./db.ts";

// Result type - function NEVER throws, always returns result object
type ProcessNotesExportResult =
  | { success: true }
  | { success: true; skipped: true; reason: string }
  | { success: false; error: "not_found" }
  | { success: false; error: "export_failed"; message: string };

export async function processNotesExport(broadcastId: number): Promise<ProcessNotesExportResult> {
  console.info(`[notes] Starting export for broadcast ${broadcastId}`);

  try {
    // 1. Fetch broadcast
    const broadcast = await getBroadcastForExport(broadcastId);
    if (!broadcast) {
      console.warn(`[notes] Broadcast not found: ${broadcastId}`);
      return { success: false, error: "not_found" };
    }

    // 2. Skip if notes empty/whitespace
    if (!broadcast.notes || !broadcast.notes.trim().length) {
      console.info(`[notes] Skipping export for broadcast ${broadcastId}: no notes`);
      return { success: true, skipped: true, reason: "No notes to export" };
    }

    // 3. Fetch meeting data
    const meeting = await getMeetingForExport(broadcast.meetingId);
    if (!meeting) {
      return { success: false, error: "export_failed", message: "Meeting not found" };
    }

    // 4. Build markdown document with metadata header
    const markdown = buildMarkdownDocument(broadcast, meeting);

    // 5. Convert to docx via Rust server
    const docxBytes = await convertToDocx(markdown);

    // 6. Upload to S3
    const s3Key = `portal/${broadcast.orgId}/${broadcast.meetingId}/broadcast_notes_${Date.now()}.docx`;
    await putObject({
      key: s3Key,
      body: docxBytes,
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    // 7. Create artifact record
    const sanitizedTitle = meeting.title.replace(/[^a-zA-Z0-9]/g, "_");
    const fileName = `${sanitizedTitle}_Broadcast_Notes.docx`;
    const s3Url = `https://govclerk-audio-uploads.s3.us-east-2.amazonaws.com/${s3Key}`;

    const conn = getDb();
    await conn.execute(
      `INSERT INTO gc_artifacts (
        org_id, portal_settings_id, meeting_id, artifact_type, 
        file_name, file_size, content_type, s3_key, s3_url, is_public
      ) VALUES (?, ?, ?, 'other', ?, ?, ?, ?, ?, 0)`,
      [
        broadcast.orgId,
        meeting.portalSettingsId,
        broadcast.meetingId,
        fileName,
        docxBytes.length,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        s3Key,
        s3Url,
      ]
    );

    console.info(`[notes] Successfully exported notes for broadcast ${broadcastId} to ${s3Key}`);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[notes] Export failed for broadcast ${broadcastId}:`, err);
    return { success: false, error: "export_failed", message };
  }
}

function buildMarkdownDocument(
  broadcast: { notes: string | null; startedAt: Date | null; endedAt: Date | null },
  meeting: { title: string; meetingDate: Date | null }
): string {
  const lines: string[] = [];

  // Title
  lines.push(`# Meeting Notes: ${meeting.title}`);
  lines.push("");

  // Date
  if (meeting.meetingDate) {
    const dateStr = meeting.meetingDate.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    lines.push(`**Date:** ${dateStr}`);
  }

  // Duration (only if started_at exists)
  if (broadcast.startedAt) {
    const endTime = broadcast.endedAt || new Date();
    const durationMs = endTime.getTime() - broadcast.startedAt.getTime();
    const durationMinutes = Math.max(1, Math.round(durationMs / 60000)); // Minimum 1 minute
    lines.push(
      `**Broadcast Duration:** ${durationMinutes} minute${durationMinutes !== 1 ? "s" : ""}`
    );
  }

  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push(broadcast.notes || "");

  return lines.join("\n");
}

async function convertToDocx(markdown: string): Promise<Uint8Array> {
  const rustServerUrl = process.env.RUST_SERVER_URL || "http://127.0.0.1:8000";
  const authSecret = process.env.UPLOAD_COMPLETE_WEBHOOK_SECRET;

  if (!authSecret) {
    throw new Error("UPLOAD_COMPLETE_WEBHOOK_SECRET not configured");
  }

  const form = new FormData();
  form.append("file", new Blob([markdown], { type: "text/markdown" }), "notes.md");
  form.append("output_type", "docx");
  form.append("input_type", "gfm");

  const response = await fetch(`${rustServerUrl}/api/convert-document`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${authSecret}`,
    },
    body: form,
  });

  if (!response.ok) {
    throw new Error(`Rust server conversion failed: ${response.status}`);
  }

  return new Uint8Array(await response.arrayBuffer());
}
