import https from "https";
import { S3Event } from "aws-lambda";
import { connect } from "@planetscale/database";

import sendHttpRequest from "./sendHttpRequest";
import { assertString } from "../utils/assert";
import { capture } from "../utils/posthog";

async function logEvent(
  transcriptId: number,
  event: "s3_lambda_webhook_called" | "s3_lambda_webhook_failed",
  properties: { [key: string]: unknown }
): Promise<void> {
  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  const rows = await conn
    .execute("SELECT userId FROM transcripts WHERE id = ?", [transcriptId])
    .then((result) => result.rows);

  const userId = rows[0]["userId"];

  await capture(
    event,
    {
      ...properties,
      transcriptId,
    },
    userId
  );
}

async function markJobFailed(transcriptId: number): Promise<void> {
  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  await conn.execute("UPDATE transcripts SET transcribe_failed = 101 WHERE id = ?", [transcriptId]);
}

export const handler = async (event: S3Event): Promise<void> => {
  const s3Key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, " "));

  if (s3Key.startsWith("test_")) {
    return;
  }

  const transcriptId = parseInt(s3Key.split("_").slice(-1)[0]);

  const postData = JSON.stringify({ s3_audio_key: s3Key });

  const options: https.RequestOptions = {
    hostname: process.env.SERVER_HOSTNAME || "server.GovClerkMinutes.com",
    port: 443,
    path: "/api/get-diarization",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(postData),
      "x-webhook-signature": assertString(process.env.UPLOAD_COMPLETE_WEBHOOK_SECRET),
      Authorization: `Bearer ${assertString(process.env.UPLOAD_COMPLETE_WEBHOOK_SECRET)}`,
    },
  };

  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const start = Date.now();

      const response = await sendHttpRequest(options, postData);

      const duration = Date.now() - start;

      await logEvent(transcriptId, "s3_lambda_webhook_called", { duration, response });

      return;
    } catch (error) {
      const err = error instanceof Error ? error.message : error;
      console.error(`Attempt ${attempt} failed:`, err);
      if (attempt === maxAttempts) {
        await logEvent(transcriptId, "s3_lambda_webhook_failed", { err });
        await markJobFailed(transcriptId);
        throw {
          statusCode: 500,
          body: "Failed to fetch data after 3 attempts",
        };
      }
    }
  }
};
