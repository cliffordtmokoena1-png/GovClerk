import { getAuth } from "@clerk/nextjs/server";
import { NextApiRequest, NextApiResponse } from "next";
import { S3Client, CompleteMultipartUploadCommand, ListPartsCommand } from "@aws-sdk/client-s3";
import { assertString } from "@/utils/assert";
import { getTranscriptBucketNameByRegion, getUploadKey, Region } from "@/utils/s3";
import withErrorReporting from "@/error/withErrorReporting";
import { connect } from "@planetscale/database";
import { serverUri } from "@/utils/server";

export type ApiCompleteUploadResponse = {};

export type CompleteUploadParams = {
  transcriptId: number;
  uploadId: string;
  parts?: Array<{
    ETag: string;
    PartNumber: number;
  }>;
  userId?: string; // For regular uploads (with user auth check)
  isAdminUpload?: boolean; // For admin uploads (skip user auth check and trigger webhook)
  isRecording?: boolean; // For recorder uploads
};

export async function completeUpload(params: CompleteUploadParams): Promise<void> {
  const { transcriptId, uploadId, parts, userId, isAdminUpload, isRecording } = params;

  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  const selectQuery = isAdminUpload
    ? "SELECT aws_region, upload_kind FROM transcripts WHERE id = ?;"
    : "SELECT aws_region FROM transcripts WHERE id = ? AND userId = ?;";

  const selectParams = isAdminUpload ? [transcriptId] : [transcriptId, userId];

  const rows = await conn.execute(selectQuery, selectParams).then((res) => res.rows);

  if (!rows || rows.length === 0) {
    throw new Error("Transcript not found or access denied");
  }

  const region: Region = rows[0]["aws_region"];

  const s3 = new S3Client({
    credentials: {
      accessKeyId: assertString(process.env.AWS_ACCESS_KEY_ID),
      secretAccessKey: assertString(process.env.AWS_SECRET_ACCESS_KEY),
    },
    region,
  });

  const key = getUploadKey(transcriptId, isAdminUpload ? { env: "prod" } : undefined);

  // When the client doesn't supply part ETags (e.g., browser CORS blocks the
  // ETag response header on presigned S3 PUT requests), fetch the part list
  // directly from S3 so we can still complete the multipart upload.
  let resolvedParts = parts;
  if (!resolvedParts || resolvedParts.length === 0) {
    const listCommand = new ListPartsCommand({
      Bucket: getTranscriptBucketNameByRegion(region),
      Key: key,
      UploadId: uploadId,
    });
    const listResult = await s3.send(listCommand);
    resolvedParts = (listResult.Parts ?? [])
      .filter((p) => p.ETag != null && p.PartNumber != null)
      .map((p) => ({
        ETag: p.ETag!,
        PartNumber: p.PartNumber!,
      }));
  }

  const command = new CompleteMultipartUploadCommand({
    Bucket: getTranscriptBucketNameByRegion(region),
    Key: key,
    UploadId: uploadId,
    MultipartUpload: { Parts: resolvedParts },
  });

  await s3.send(command);

  // For recording uploads, update the recording session state BEFORE triggering
  // the webhook to avoid a race condition where the pipeline sees a stale state.
  if (isRecording) {
    await conn.execute(
      `UPDATE recording_sessions AS rs
     JOIN transcripts AS t
       ON t.id = rs.transcript_id
     SET
       rs.recording_state = ?,
       rs.updated_at = UTC_TIMESTAMP(),
       t.recording_state = 1
     WHERE
       rs.transcript_id = ? AND
       rs.user_id = ?`,
      ["completed", transcriptId, userId]
    );
  }

  // Trigger the transcription pipeline webhook for ALL upload types, including
  // recordings. Regular uploads may also rely on S3 event notifications (Lambda),
  // but we fire the webhook here explicitly to ensure transcription starts even
  // when the Lambda event is delayed or misconfigured in production.
  const webhookSecret = process.env.UPLOAD_COMPLETE_WEBHOOK_SECRET;
  if (webhookSecret) {
    // error code 50 = webhook trigger failure (recoverable: user can retry)
    const markTranscriptFailed = () =>
      conn
        .execute("UPDATE transcripts SET transcribe_failed = 50 WHERE id = ?", [transcriptId])
        .catch((dbErr) =>
          console.error(
            `[complete-upload] Failed to mark transcript ${transcriptId} as failed:`,
            dbErr
          )
        );

    // Small delay to allow S3 to propagate the newly assembled object before
    // the transcription server attempts to read it.
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Retry the webhook up to 3 times with exponential backoff before giving up.
    const MAX_ATTEMPTS = 3;
    let lastError: unknown = null;
    let succeeded = false;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        if (attempt > 1) {
          // Exponential backoff: 2s, 4s
          await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** (attempt - 1)));
        }
        console.info(
          `[complete-upload] Triggering transcription webhook (attempt ${attempt}/${MAX_ATTEMPTS}) for transcript ${transcriptId}, key ${key}`
        );
        const webhookRes = await fetch(serverUri("/api/get-diarization"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-webhook-signature": webhookSecret,
            Authorization: "Bearer " + webhookSecret,
          },
          body: JSON.stringify({ s3_audio_key: key }),
        });
        if (webhookRes.ok || webhookRes.status === 409) {
          // 409 = already processed, which is acceptable.
          succeeded = true;
          break;
        }
        console.error(
          `[complete-upload] Transcription webhook responded with status ${webhookRes.status} (attempt ${attempt}) for transcript ${transcriptId}`
        );
        lastError = new Error(`HTTP ${webhookRes.status}`);
      } catch (fetchErr) {
        console.error(
          `[complete-upload] Transcription webhook fetch error (attempt ${attempt}) for transcript ${transcriptId}:`,
          fetchErr
        );
        lastError = fetchErr;
      }
    }

    if (!succeeded) {
      console.error(
        `[complete-upload] All ${MAX_ATTEMPTS} webhook attempts failed for transcript ${transcriptId}. Last error:`,
        lastError
      );
      // Mark transcript as failed (code 50 = webhook trigger failure) so the UI
      // can show a specific, actionable message and allow the user to retry.
      await markTranscriptFailed();
    }
  }
}

async function handler(req: NextApiRequest, res: NextApiResponse<ApiCompleteUploadResponse>) {
  const { userId } = getAuth(req);
  if (userId == null) {
    return res.status(401).json({});
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  const transcriptId: number = body["transcriptId"];
  const uploadId: string = body["uploadId"];
  const parts: Array<{
    ETag: string;
    PartNumber: number;
  }> = body["parts"];

  await completeUpload({
    transcriptId,
    uploadId,
    parts,
    userId,
  });

  return res.status(200).json({});
}

export default withErrorReporting(handler);
