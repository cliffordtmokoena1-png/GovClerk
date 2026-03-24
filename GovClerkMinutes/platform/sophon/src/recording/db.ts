import { getDb } from "../db.ts";

export type RecordingStatus = "pending" | "recording" | "processing" | "completed" | "failed";

export interface RecordingData {
  s3Key?: string;
  s3UploadId?: string;
  fileSize?: number;
  durationMs?: number;
  thumbnailS3Key?: string;
  errorMessage?: string;
  startedAt?: Date;
  endedAt?: Date;
}

export interface Recording {
  id: number;
  broadcastId: number;
  streamKey: string;
  status: RecordingStatus;
  s3Key: string | null;
  s3UploadId: string | null;
  fileSize: number | null;
  durationMs: number | null;
  thumbnailS3Key: string | null;
  errorMessage: string | null;
  startedAt: Date | null;
  endedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export async function createRecording(broadcastId: number, streamKey: string): Promise<number> {
  const conn = getDb();

  const result = await conn.execute(
    `INSERT INTO gc_broadcast_recordings (broadcast_id, stream_key, status, created_at, updated_at)
     VALUES (?, ?, 'pending', NOW(), NOW())`,
    [broadcastId, streamKey]
  );

  if (!result.insertId) {
    throw new Error("Failed to create recording: no insertId returned");
  }

  return result.insertId as number;
}

export async function updateRecordingStatus(
  recordingId: number,
  status: RecordingStatus,
  data?: Partial<RecordingData>
): Promise<void> {
  const conn = getDb();

  let updateFields = ["status = ?"];
  let params: any[] = [status];

  if (data) {
    if (data.s3Key !== undefined) {
      updateFields.push("s3_key = ?");
      params.push(data.s3Key);
    }
    if (data.s3UploadId !== undefined) {
      updateFields.push("s3_upload_id = ?");
      params.push(data.s3UploadId);
    }
    if (data.fileSize !== undefined) {
      updateFields.push("file_size = ?");
      params.push(data.fileSize);
    }
    if (data.durationMs !== undefined) {
      updateFields.push("duration_ms = ?");
      params.push(data.durationMs);
    }
    if (data.thumbnailS3Key !== undefined) {
      updateFields.push("thumbnail_s3_key = ?");
      params.push(data.thumbnailS3Key);
    }
    if (data.errorMessage !== undefined) {
      updateFields.push("error_message = ?");
      params.push(data.errorMessage);
    }
    if (data.startedAt !== undefined) {
      updateFields.push("started_at = ?");
      params.push(data.startedAt);
    }
    if (data.endedAt !== undefined) {
      updateFields.push("ended_at = ?");
      params.push(data.endedAt);
    }
  }

  updateFields.push("updated_at = NOW()");
  params.push(recordingId);

  await conn.execute(
    `UPDATE gc_broadcast_recordings 
     SET ${updateFields.join(", ")} 
     WHERE id = ?`,
    params
  );
}

export async function getRecordingByStreamKey(streamKey: string): Promise<Recording | null> {
  const conn = getDb();

  const result = await conn.execute(`SELECT * FROM gc_broadcast_recordings WHERE stream_key = ?`, [
    streamKey,
  ]);

  if (!result.rows || result.rows.length === 0) {
    return null;
  }

  return mapRowToRecording(result.rows[0] as any);
}

export async function getRecordingById(recordingId: number): Promise<Recording | null> {
  const conn = getDb();

  const result = await conn.execute(`SELECT * FROM gc_broadcast_recordings WHERE id = ?`, [
    recordingId,
  ]);

  if (!result.rows || result.rows.length === 0) {
    return null;
  }

  return mapRowToRecording(result.rows[0] as any);
}

export async function getRecordingsByBroadcastId(broadcastId: number): Promise<Recording[]> {
  const conn = getDb();

  const result = await conn.execute(
    `SELECT * FROM gc_broadcast_recordings WHERE broadcast_id = ? ORDER BY created_at DESC`,
    [broadcastId]
  );

  if (!result.rows || result.rows.length === 0) {
    return [];
  }

  return (result.rows as any[]).map(mapRowToRecording);
}

export async function getActiveRecordingByStreamKey(streamKey: string): Promise<Recording | null> {
  const conn = getDb();

  const result = await conn.execute(
    `SELECT * FROM gc_broadcast_recordings 
     WHERE stream_key = ? AND status IN ('pending', 'recording', 'processing')`,
    [streamKey]
  );

  if (!result.rows || result.rows.length === 0) {
    return null;
  }

  return mapRowToRecording(result.rows[0] as any);
}

function mapRowToRecording(row: any): Recording {
  return {
    id: row.id as number,
    broadcastId: row.broadcast_id as number,
    streamKey: row.stream_key as string,
    status: row.status as RecordingStatus,
    s3Key: row.s3_key as string | null,
    s3UploadId: row.s3_upload_id as string | null,
    fileSize: row.file_size as number | null,
    durationMs: row.duration_ms as number | null,
    thumbnailS3Key: row.thumbnail_s3_key as string | null,
    errorMessage: row.error_message as string | null,
    startedAt: row.started_at ? new Date(row.started_at as string) : null,
    endedAt: row.ended_at ? new Date(row.ended_at as string) : null,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}
