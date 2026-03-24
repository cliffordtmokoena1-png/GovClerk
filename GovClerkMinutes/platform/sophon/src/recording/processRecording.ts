import { getDb } from "../db.ts";
import { getRecordingById, updateRecordingStatus } from "./db.ts";
import type { Recording } from "./db.ts";
import {
  findProgressOperation,
  updateProgress,
  completeOperation,
  failOperation,
} from "../progress/db.ts";

export async function processRecording(recordingId: number): Promise<void> {
  const recording = await getRecordingById(recordingId);
  if (!recording) {
    throw new Error(`Recording not found: ${recordingId}`);
  }

  if (!recording.s3Key) {
    throw new Error(`Cannot process recording ${recording.id}: missing s3Key`);
  }

  console.info(`[recording] Starting post-processing for recording ${recordingId}`);

  await updateRecordingStatus(recordingId, "processing");

  const broadcast = await getDb().execute("SELECT meeting_id FROM gc_broadcasts WHERE id = ?", [
    recording.broadcastId,
  ]);
  const meetingId = (broadcast.rows[0] as any)?.meeting_id;

  const progressOp = meetingId
    ? await findProgressOperation(meetingId, "recording", recordingId)
    : null;

  if (progressOp) {
    await updateProgress(progressOp.id, 0, {
      ...progressOp.metadata,
      stage: "processing",
    });
  }

  try {
    const durationMs = await extractDuration(recording.s3Key || "");
    console.info(`[recording] Extracted duration: ${durationMs}ms`);

    const thumbnailKey = await generateThumbnail(recording.s3Key || "", recordingId);
    console.info(`[recording] Generated thumbnail: ${thumbnailKey}`);

    await updateRecordingStatus(recordingId, "completed", {
      durationMs,
      thumbnailS3Key: thumbnailKey,
    });

    await createRecordingArtifact(recording);
    console.info(`[recording] Created artifact for recording ${recordingId}`);

    if (progressOp) {
      await completeOperation(progressOp.id, {
        recordingId,
        stage: "completed",
        s3Key: recording.s3Key,
        durationMs,
        thumbnailKey,
      });
    }

    console.info(`[recording] Post-processing completed for recording ${recordingId}`);
  } catch (err) {
    console.error(`[recording] Processing failed for ${recordingId}:`, err);

    await updateRecordingStatus(recordingId, "failed", {
      errorMessage: String(err),
    });

    await createRecordingArtifact(recording, { processingFailed: true });

    if (progressOp) {
      await failOperation(progressOp.id, String(err));
    }

    throw err;
  }
}

async function extractDuration(s3Key: string): Promise<number> {
  // TODO: Implement actual ffprobe extraction with S3 presigned URL
  console.warn(`[recording] extractDuration not yet implemented, returning placeholder`);
  return 0;
}

async function generateThumbnail(s3Key: string, recordingId: number): Promise<string> {
  // TODO: Implement actual thumbnail generation with ffmpeg
  console.warn(`[recording] generateThumbnail not yet implemented, returning placeholder`);
  return `${s3Key.replace(".mp4", "_thumb.jpg")}`;
}

async function createRecordingArtifact(
  recording: Recording,
  options?: { processingFailed?: boolean }
): Promise<void> {
  const conn = getDb();

  const broadcastRes = await conn.execute(
    "SELECT meeting_id, org_id FROM gc_broadcasts WHERE id = ?",
    [recording.broadcastId]
  );

  if (!broadcastRes.rows || broadcastRes.rows.length === 0) {
    throw new Error(`Broadcast not found for recording ${recording.id}`);
  }

  const broadcast = broadcastRes.rows[0] as { meeting_id: number; org_id: string };

  const meetingRes = await conn.execute("SELECT portal_settings_id FROM gc_meetings WHERE id = ?", [
    broadcast.meeting_id,
  ]);

  if (!meetingRes.rows || meetingRes.rows.length === 0) {
    throw new Error(`Meeting not found: ${broadcast.meeting_id}`);
  }

  const meeting = meetingRes.rows[0] as { portal_settings_id: number };

  const fileName = `Recording ${new Date().toISOString()}.mp4`;

  const s3Url = `https://govclerk-audio-uploads.s3.us-east-2.amazonaws.com/${recording.s3Key}`;

  await conn.execute(
    `INSERT INTO gc_artifacts (
      org_id, portal_settings_id, meeting_id, artifact_type, 
      file_name, file_size, content_type, s3_key, s3_url, is_public
    ) VALUES (?, ?, ?, 'meeting_recording', ?, ?, 'video/mp4', ?, ?, 0)`,
    [
      broadcast.org_id,
      meeting.portal_settings_id,
      broadcast.meeting_id,
      fileName,
      recording.fileSize || 0,
      recording.s3Key,
      s3Url,
    ]
  );

  console.info(
    `[recording] Created artifact for recording ${recording.id} (meeting ${broadcast.meeting_id})`
  );
}
