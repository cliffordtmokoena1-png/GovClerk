import { getAuth } from "@clerk/nextjs/server";
import { connect } from "@planetscale/database";
import withErrorReporting from "@/error/withErrorReporting";
import { NextRequest } from "next/server";
import { getCurrentBalance } from "@/pages/api/get-tokens";
import { serverUri } from "@/utils/server";

export const config = {
  runtime: "edge",
};

/**
 * Finds all paused transcripts for the authenticated user, checks whether the
 * current token balance is sufficient to cover each one, and — for each that
 * now has enough tokens — resets transcribe_paused and fires the transcription
 * webhook so processing resumes automatically.
 */
async function handler(req: NextRequest) {
  const { userId } = getAuth(req);
  if (userId == null) {
    return new Response(null, { status: 401 });
  }

  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  const currentBalance = await getCurrentBalance(userId, null);
  if (currentBalance == null || currentBalance <= 0) {
    return new Response(JSON.stringify({ resumed: 0, message: "Insufficient balance" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const pausedRows = await conn
    .execute(
      `SELECT id, credits_required, s3AudioKey
       FROM transcripts
       WHERE userId = ? AND transcribe_paused = 1 AND transcribe_finished = 0`,
      [userId]
    )
    .then((res) => res.rows as Array<{ id: number; credits_required: number; s3AudioKey: string }>);

  if (pausedRows.length === 0) {
    return new Response(JSON.stringify({ resumed: 0, message: "No paused transcripts" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const webhookSecret = process.env.UPLOAD_COMPLETE_WEBHOOK_SECRET;
  let resumedCount = 0;
  let runningBalance = currentBalance;

  for (const transcript of pausedRows) {
    const creditsRequired = transcript.credits_required ?? 0;
    if (runningBalance < creditsRequired) {
      continue;
    }

    let updateSuccess = false;

    // Reset paused state so the transcript can be processed.
    try {
      await conn.execute("UPDATE transcripts SET transcribe_paused = 0 WHERE id = ?", [
        transcript.id,
      ]);
      updateSuccess = true;
    } catch (err) {
      console.error(
        `[resume-paused-transcripts] Failed to reset paused for ${transcript.id}:`,
        err
      );
    }

    if (!updateSuccess) {
      continue;
    }

    // Re-trigger the transcription webhook.
    let webhookSuccess = false;
    if (webhookSecret && transcript.s3AudioKey) {
      try {
        console.info(
          `[resume-paused-transcripts] Triggering transcription for paused transcript ${transcript.id}`
        );
        const webhookRes = await fetch(serverUri("/api/get-diarization"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-webhook-signature": webhookSecret,
            Authorization: "Bearer " + webhookSecret,
          },
          body: JSON.stringify({ s3_audio_key: transcript.s3AudioKey }),
        });
        if (webhookRes.ok || webhookRes.status === 409) {
          webhookSuccess = true;
        } else {
          console.error(
            `[resume-paused-transcripts] Webhook responded with ${webhookRes.status} for transcript ${transcript.id}`
          );
        }
      } catch (err) {
        console.error(
          `[resume-paused-transcripts] Failed to trigger webhook for transcript ${transcript.id}:`,
          err
        );
      }
    } else {
      // No webhook configured or no S3 key — still count as success since DB was updated.
      webhookSuccess = true;
    }

    if (webhookSuccess) {
      // Deduct from running balance so subsequent transcripts see the updated total.
      runningBalance -= creditsRequired;
      resumedCount++;
    }
  }

  return new Response(JSON.stringify({ resumed: resumedCount }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

export default withErrorReporting(handler);
