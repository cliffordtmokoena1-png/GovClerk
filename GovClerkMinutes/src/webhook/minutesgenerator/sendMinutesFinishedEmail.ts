import { connect } from "@planetscale/database";
import { sendEmail } from "@/utils/postmark";
import { serverUri } from "@/utils/server";
import getPrimaryEmail from "@/utils/email";
import { OUTGOING_BCC_EMAIL } from "@/crm/hubspot/consts";
import { getSpeakerMap, substituteSpeakerLabels } from "@/utils/speakers";
import { fetchSettings } from "@/settings/settings";

type MinutesRow = {
  user_id: string;
  minutes: string;
  title: string;
};

export async function sendMinutesFinishedEmail(transcriptId: number): Promise<void> {
  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  // Get the latest minutes and user_id for this transcript
  const minutesRows = await conn
    .execute<MinutesRow>(
      `
    SELECT
      user_id,
      minutes,
      t.title
    FROM minutes m
    JOIN transcripts t
    ON m.transcript_id = t.id
    WHERE m.transcript_id = ?
    AND m.minutes IS NOT NULL 
    ORDER BY m.version DESC LIMIT 1`,
      [transcriptId]
    )
    .then((r) => r.rows);

  if (minutesRows.length === 0) {
    console.error(`No minutes found for transcript_id=${transcriptId}`);
    return;
  }

  const { user_id: userId, minutes: rawMinutes, title } = minutesRows[0];

  const settings = await fetchSettings(userId);
  if (!settings["send-email-when-minutes-done"]) {
    console.warn("User has disabled minutes ready emails");
    return;
  }

  const email = await getPrimaryEmail(userId);
  if (!email) {
    console.error(`No email found for user_id=${userId}`);
    return;
  }

  const speakerMap = await getSpeakerMap(transcriptId);
  const minutes = substituteSpeakerLabels(rawMinutes, speakerMap);
  if (!minutes) {
    console.error(`No minutes content found for transcript_id=${transcriptId}`);
    return;
  }

  const formData = new FormData();
  formData.append("file", new Blob([minutes], { type: "text/markdown" }), "minutes.md");
  formData.append("output_type", "pdf");
  formData.append("input_type", "gfm");

  const convertResponse = await fetch(serverUri("/api/convert-document"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.UPLOAD_COMPLETE_WEBHOOK_SECRET}`,
    },
    body: formData,
  });

  if (!convertResponse.ok) {
    throw new Error(`Failed to convert document: ${convertResponse.status}`);
  }

  const docBuffer = await convertResponse.arrayBuffer();
  const docBase64 = Buffer.from(docBuffer).toString("base64");

  await sendEmail({
    From: '"GovClerkMinutes" <max@mail.GovClerkMinutes.com>',
    To: email,
    Bcc: [OUTGOING_BCC_EMAIL],
    Subject: `Your meeting minutes are ready: ${title}`,
    HtmlBody: `Your meeting minutes for ${title} have been generated and are ready for download!<br /><br />You can view, edit, and download them from the <a href='https://GovClerkMinutes.com/dashboard/${transcriptId}?utm_medium=femail'>dashboard</a>.<br /><br />The document is also attached to this email for your convenience.`,
    TextBody: `Your meeting minutes for ${title} have been generated and are ready for download!\n\nYou can view, edit, and download them from the dashboard at: https://GovClerkMinutes.com/dashboard/${transcriptId}\n\nThe document is also attached to this email for your convenience.`,
    MessageStream: "signup_and_purchase",
    Attachments: [
      {
        Name: `GC_Minutes_${title.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 20)}.pdf`,
        Content: docBase64,
        ContentType: "application/pdf",
      },
    ],
  });

  // eslint-disable-next-line no-console
  console.log(
    `Successfully sent minutes ready email for transcript_id=${transcriptId} to ${email}`
  );
}
