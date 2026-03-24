import { getDb } from "../db.ts";

export type OperationType =
  | "recording"
  | "minutes_generation"
  | "minutes_export"
  | "transcript_export";
export type ProgressStatus = "pending" | "in_progress" | "completed" | "failed";

export type ProgressOperation = {
  id: number;
  meetingId: number;
  operationType: OperationType;
  status: ProgressStatus;
  progressPercent: number;
  metadata: any;
  errorMessage: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export async function createProgressOperation(
  meetingId: number,
  operationType: OperationType,
  metadata?: object
): Promise<number> {
  const conn = getDb();
  const result = await conn.execute(
    `INSERT INTO gc_progress_operations (meeting_id, operation_type, status, metadata, started_at)
     VALUES (?, ?, 'pending', ?, NOW())`,
    [meetingId, operationType, metadata ? JSON.stringify(metadata) : null]
  );
  return (result as any).insertId;
}

export async function updateProgress(
  operationId: number,
  percent: number,
  metadata?: object
): Promise<void> {
  const conn = getDb();
  const updates: string[] = ["progress_percent = ?", "status = ?"];
  const params: any[] = [percent, "in_progress"];

  if (metadata !== undefined) {
    updates.push("metadata = ?");
    params.push(JSON.stringify(metadata));
  }

  params.push(operationId);

  await conn.execute(
    `UPDATE gc_progress_operations SET ${updates.join(", ")} WHERE id = ?`,
    params
  );
}

export async function completeOperation(operationId: number, metadata?: object): Promise<void> {
  const conn = getDb();
  const updates: string[] = ["status = ?", "progress_percent = ?", "completed_at = NOW()"];
  const params: any[] = ["completed", 100];

  if (metadata !== undefined) {
    updates.push("metadata = ?");
    params.push(JSON.stringify(metadata));
  }

  params.push(operationId);

  await conn.execute(
    `UPDATE gc_progress_operations SET ${updates.join(", ")} WHERE id = ?`,
    params
  );
}

export async function failOperation(operationId: number, errorMessage: string): Promise<void> {
  const conn = getDb();
  await conn.execute(
    `UPDATE gc_progress_operations 
     SET status = 'failed', error_message = ?, completed_at = NOW() 
     WHERE id = ?`,
    [errorMessage, operationId]
  );
}

export async function getActiveOperations(meetingId: number): Promise<ProgressOperation[]> {
  const conn = getDb();
  const result = await conn.execute(
    `SELECT * FROM gc_progress_operations 
     WHERE meeting_id = ? AND status IN ('pending', 'in_progress')
     ORDER BY created_at DESC`,
    [meetingId]
  );

  return (result.rows as any[]).map((row) => {
    let parsedMetadata: any = null;
    if (row.metadata) {
      if (typeof row.metadata === "string") {
        try {
          parsedMetadata = JSON.parse(row.metadata);
        } catch {
          parsedMetadata = null;
        }
      } else {
        parsedMetadata = row.metadata;
      }
    }

    return {
      id: row.id,
      meetingId: row.meeting_id,
      operationType: row.operation_type,
      status: row.status,
      progressPercent: row.progress_percent,
      metadata: parsedMetadata,
      errorMessage: row.error_message,
      startedAt: row.started_at ? new Date(row.started_at) : null,
      completedAt: row.completed_at ? new Date(row.completed_at) : null,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  });
}

export async function findProgressOperation(
  meetingId: number,
  operationType: OperationType,
  recordingId?: number
): Promise<ProgressOperation | null> {
  const conn = getDb();

  let sql = `SELECT * FROM gc_progress_operations 
             WHERE meeting_id = ? AND operation_type = ?`;
  const params: any[] = [meetingId, operationType];

  if (recordingId !== undefined) {
    sql += ' AND JSON_EXTRACT(metadata, "$.recordingId") = ?';
    params.push(recordingId);
  }

  sql += " ORDER BY created_at DESC LIMIT 1";

  const result = await conn.execute(sql, params);

  if (!result.rows || result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0] as any;
  let parsedMetadata: any = null;
  if (row.metadata) {
    if (typeof row.metadata === "string") {
      try {
        parsedMetadata = JSON.parse(row.metadata);
      } catch {
        parsedMetadata = null;
      }
    } else {
      parsedMetadata = row.metadata;
    }
  }

  return {
    id: row.id,
    meetingId: row.meeting_id,
    operationType: row.operation_type,
    status: row.status,
    progressPercent: row.progress_percent,
    metadata: parsedMetadata,
    errorMessage: row.error_message,
    startedAt: row.started_at ? new Date(row.started_at) : null,
    completedAt: row.completed_at ? new Date(row.completed_at) : null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}
