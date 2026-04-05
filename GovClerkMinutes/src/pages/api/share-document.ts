import withErrorReporting from "@/error/withErrorReporting";
import { getAuth } from "@clerk/nextjs/server";
import type { NextApiRequest, NextApiResponse } from "next";
import { connect } from "@planetscale/database";
import { sendEmail, isValidEmailFormat } from "@/utils/postmark";
import { serverUri } from "@/utils/server";
import { getSpeakerMap, substituteSpeakerLabels } from "@/utils/speakers";
import { getClerkKeys } from "@/utils/clerk";

export const config = {
  runtime: "nodejs",
};

const FROM_MINUTES = '"GovClerk Minutes" <admin@govclerkminutes.com>';
const NAVY = "#1a3c6e";

type DocumentType = "minutes" | "transcript" | "both";

interface ShareDocumentBody {
  transcriptId: number;
  emails: string[];
  documentType: DocumentType;
}

async function convertToPdf(markdown: string): Promise<Buffer> {
  const form = new FormData();
  form.append("file", new Blob([markdown], { type: "text/markdown" }), "document.md");
  form.append("output_type", "pdf");
  form.append("input_type", "gfm");

  const response = await fetch(serverUri("/api/convert-document"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.UPLOAD_COMPLETE_WEBHOOK_SECRET}`,
    },
    body: form,
  });

  if (!response.ok) {
    throw new Error(`Failed to convert document: ${response.status}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

function buildShareEmailHtml(
  senderName: string,
  meetingTitle: string,
  documentType: DocumentType
): string {
  const docLabel =
    documentType === "both"
      ? "meeting minutes and transcript"
      : documentType === "minutes"
        ? "meeting minutes"
        : "meeting transcript";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9;padding:40px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
      <!-- Header -->
      <tr>
        <td style="background-color:${NAVY};padding:28px 40px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:600;letter-spacing:0.5px;">GovClerk Minutes</h1>
        </td>
      </tr>
      <!-- Body -->
      <tr>
        <td style="padding:40px 40px 32px;">
          <p style="margin:0 0 16px;font-size:16px;color:#2d3748;">Hello,</p>
          <p style="margin:0 0 20px;font-size:15px;color:#4a5568;line-height:1.7;"><strong>${senderName}</strong> has shared the ${docLabel} for the following meeting with you:</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7fafc;border-left:4px solid ${NAVY};border-radius:4px;margin:0 0 28px;">
            <tr><td style="padding:20px 24px;">
              <p style="margin:0;font-size:16px;font-weight:600;color:#1a202c;">${meetingTitle}</p>
            </td></tr>
          </table>
          <p style="margin:0 0 20px;font-size:15px;color:#4a5568;line-height:1.7;">The document${documentType === "both" ? "s are" : " is"} attached to this email as PDF${documentType === "both" ? "s" : ""}.</p>
          <p style="margin:0 0 20px;font-size:14px;color:#718096;line-height:1.7;">Want to create your own AI-powered meeting minutes? <a href="https://govclerkminutes.com/?utm_medium=share_email" style="color:${NAVY};font-weight:600;">Sign up for free at GovClerkMinutes.com</a> — upload your first recording and get professional minutes in minutes.</p>
          <p style="margin:24px 0 0;font-size:15px;color:#2d3748;">Warm regards,<br/><strong>Cliff Mokoena</strong><br/><span style="color:#8a94a6;font-size:13px;">Founder, GovClerk Minutes</span></p>
        </td>
      </tr>
      <!-- Footer -->
      <tr>
        <td style="background-color:#f8f9fb;padding:20px 40px;border-top:1px solid #e8ecf0;text-align:center;">
          <p style="margin:0;font-size:12px;color:#8a94a6;">GovClerk Minutes · <a href="https://govclerkminutes.com" style="color:${NAVY};text-decoration:none;">govclerkminutes.com</a></p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function buildShareEmailText(
  senderName: string,
  meetingTitle: string,
  documentType: DocumentType
): string {
  const docLabel =
    documentType === "both"
      ? "meeting minutes and transcript"
      : documentType === "minutes"
        ? "meeting minutes"
        : "meeting transcript";

  return `Hello,

${senderName} has shared the ${docLabel} for the following meeting with you:

Meeting: ${meetingTitle}

The document${documentType === "both" ? "s are" : " is"} attached to this email as PDF${documentType === "both" ? "s" : ""}.

Want to create your own AI-powered meeting minutes? Sign up for free at https://govclerkminutes.com

Warm regards,
Cliff Mokoena
Founder, GovClerk Minutes
govclerkminutes.com`;
}

async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const body: ShareDocumentBody = req.body || {};
  const { transcriptId, emails, documentType } = body;

  if (!transcriptId || typeof transcriptId !== "number") {
    res.status(400).json({ error: "transcriptId is required" });
    return;
  }

  if (!emails || !Array.isArray(emails) || emails.length === 0) {
    res.status(400).json({ error: "At least one email address is required" });
    return;
  }

  if (emails.length > 20) {
    res.status(400).json({ error: "Maximum 20 email addresses allowed" });
    return;
  }

  const invalidEmails = emails.filter((e) => !isValidEmailFormat(e));
  if (invalidEmails.length > 0) {
    res.status(400).json({ error: `Invalid email addresses: ${invalidEmails.join(", ")}` });
    return;
  }

  if (!documentType || !["minutes", "transcript", "both"].includes(documentType)) {
    res.status(400).json({ error: "documentType must be 'minutes', 'transcript', or 'both'" });
    return;
  }

  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  // Verify ownership of the transcript
  const transcriptResult = await conn.execute(
    "SELECT id, userId, title FROM transcripts WHERE id = ? AND userId = ? AND deleted = 0",
    [transcriptId, userId]
  );

  if (transcriptResult.rows.length === 0) {
    res.status(404).json({ error: "Transcript not found or access denied" });
    return;
  }

  const transcript = transcriptResult.rows[0] as { id: number; userId: string; title: string };
  const meetingTitle = transcript.title || `Meeting #${transcriptId}`;

  // Get sender's display name from Clerk for personalisation
  let senderName = "A colleague";
  try {
    const clerkKeys = getClerkKeys();
    const userRes = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
      headers: { Authorization: `Bearer ${clerkKeys.secretKey}` },
    });
    if (userRes.ok) {
      const clerkUser = await userRes.json();
      const firstName = clerkUser?.first_name;
      const lastName = clerkUser?.last_name;
      if (firstName || lastName) {
        senderName = [firstName, lastName].filter(Boolean).join(" ");
      } else {
        // Fallback to email prefix if no display name set
        const emailAddresses: Array<{ id: string; email_address: string }> =
          clerkUser?.email_addresses ?? [];
        const primaryEmailId = clerkUser?.primary_email_address_id;
        const primaryAddr = emailAddresses.find((e) => e.id === primaryEmailId);
        if (primaryAddr?.email_address) {
          senderName = primaryAddr.email_address.split("@")[0];
        }
      }
    }
  } catch {
    // Keep fallback "A colleague" if Clerk fetch fails
  }

  const attachments: Array<{ Name: string; Content: string; ContentType: string }> = [];

  // Build minutes PDF if requested
  if (documentType === "minutes" || documentType === "both") {
    const minutesResult = await conn.execute(
      "SELECT minutes FROM minutes WHERE transcript_id = ? AND minutes IS NOT NULL ORDER BY version DESC LIMIT 1",
      [transcriptId]
    );

    if (minutesResult.rows.length > 0 && minutesResult.rows[0].minutes) {
      const rawMinutes = minutesResult.rows[0].minutes as string;
      const speakerMap = await getSpeakerMap(transcriptId);
      const minutes = substituteSpeakerLabels(rawMinutes, speakerMap) ?? rawMinutes;
      const pdfBuffer = await convertToPdf(minutes);
      const safeName = meetingTitle.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 30);
      attachments.push({
        Name: `${safeName}_Minutes.pdf`,
        Content: pdfBuffer.toString("base64"),
        ContentType: "application/pdf",
      });
    }
  }

  // Build transcript PDF if requested
  if (documentType === "transcript" || documentType === "both") {
    const segmentsResult = await conn.execute(
      `SELECT gc_segments.transcript, gc_segments.speaker, speakers.name as speaker_name
       FROM gc_segments
       LEFT JOIN speakers ON gc_segments.speaker = speakers.label AND speakers.transcriptId = gc_segments.transcript_id
       WHERE gc_segments.transcript_id = ?
       ORDER BY CAST(gc_segments.start AS TIME) ASC`,
      [transcriptId]
    );

    if (segmentsResult.rows.length > 0) {
      const lines = (
        segmentsResult.rows as Array<{
          transcript: string;
          speaker: string;
          speaker_name: string | null;
        }>
      )
        .map((row) => {
          const speakerLabel = row.speaker_name || `Speaker ${row.speaker}`;
          return `**${speakerLabel}:** ${row.transcript}`;
        })
        .join("\n\n");

      const transcriptMarkdown = `# ${meetingTitle}\n\n## Transcript\n\n${lines}`;
      const pdfBuffer = await convertToPdf(transcriptMarkdown);
      const safeName = meetingTitle.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 30);
      attachments.push({
        Name: `${safeName}_Transcript.pdf`,
        Content: pdfBuffer.toString("base64"),
        ContentType: "application/pdf",
      });
    }
  }

  if (attachments.length === 0) {
    res.status(400).json({ error: "No document content available to share" });
    return;
  }

  const htmlBody = buildShareEmailHtml(senderName, meetingTitle, documentType);
  const textBody = buildShareEmailText(senderName, meetingTitle, documentType);

  const docLabel =
    documentType === "both"
      ? "meeting minutes and transcript"
      : documentType === "minutes"
        ? "meeting minutes"
        : "meeting transcript";

  const results = await Promise.allSettled(
    emails.map((email) =>
      sendEmail({
        From: FROM_MINUTES,
        To: email,
        Subject: `${senderName} shared ${docLabel} with you: ${meetingTitle}`,
        HtmlBody: htmlBody,
        TextBody: textBody,
        MessageStream: "transactional",
        Attachments: attachments,
      })
    )
  );

  const failed = results.filter((r) => r.status === "rejected");

  if (failed.length === results.length) {
    res.status(500).json({ error: "Failed to send emails" });
    return;
  }

  res.status(200).json({
    success: true,
    sent: results.length - failed.length,
    failed: failed.length,
  });
}

export default withErrorReporting(handler);
