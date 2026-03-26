import { getAuth } from "@clerk/nextjs/server";
import { NextApiRequest, NextApiResponse } from "next";
import { connect } from "@planetscale/database";
import { createS3Upload } from "../../s3";
import { Region, getUploadKey } from "@/utils/s3";
import withErrorReporting from "@/error/withErrorReporting";
import { RecordingSessionState } from "@/common/indexeddb";

type RecordingSessionData = {
  sessionId: string;
  s3UploadId: string;
  s3Key: string;
  recordingState: RecordingSessionState;
  isExisting: boolean;
};

type RecordingSessionRow = {
  session_id: string;
  s3_upload_id: string;
  s3_key: string;
  recording_state: RecordingSessionState;
  updated_at: string | Date;
  transcript_id: number;
  metadata: unknown;
  chunk_data: unknown;
};
export type ApiCreateSessionResponse = RecordingSessionData;

const conn = connect({
  host: process.env.PLANETSCALE_DB_HOST,
  username: process.env.PLANETSCALE_DB_USERNAME,
  password: process.env.PLANETSCALE_DB_PASSWORD,
});

const getTranscriptOrgId = async (transcriptId: number, userId: string): Promise<string | null> => {
  const result = await conn.execute("SELECT org_id FROM transcripts WHERE id = ? AND userId = ?", [
    transcriptId,
    userId,
  ]);
  if (result.rows.length === 0) {
    throw new Error("Transcript not found");
  }
  return result.rows[0]["org_id"] as string | null;
};

const getExistingSession = async (
  transcriptId: number,
  userId: string
): Promise<RecordingSessionRow | undefined> => {
  const result = await conn.execute<RecordingSessionRow>(
    `SELECT 
       session_id, 
       s3_upload_id, 
       s3_key, 
       recording_state,
       updated_at,
       transcript_id,
       metadata,
       chunk_data
     FROM recording_sessions
     WHERE transcript_id = ? AND user_id = ?`,
    [transcriptId, userId]
  );
  return result.rows[0];
};

const transformSessionData = (
  sessionData: RecordingSessionRow,
  isExisting: boolean
): RecordingSessionData => ({
  sessionId: sessionData.session_id,
  s3UploadId: sessionData.s3_upload_id,
  s3Key: sessionData.s3_key,
  recordingState: sessionData.recording_state,
  isExisting,
});

const updateSessionState = async (sessionId: string, state: RecordingSessionState) => {
  await conn.execute("UPDATE recording_sessions SET recording_state = ? WHERE session_id = ?", [
    state,
    sessionId,
  ]);
};

const expireSession = async (sessionId: string) => {
  try {
    await conn.execute(
      `UPDATE recording_sessions AS rs
       JOIN transcripts AS t
         ON t.id = rs.transcript_id
       SET
         rs.recording_state = ?,
         rs.updated_at      = UTC_TIMESTAMP(),
         t.recording_state  = NULL
       WHERE rs.session_id = ?`,
      ["expired", sessionId]
    );
  } catch (err) {
    console.warn("expireSession update failed", err);
  }
};

const handleExistingSession = async (
  sessionData: RecordingSessionRow
): Promise<RecordingSessionData> => {
  // Any subsequent attempt (e.g., refresh) should force expiration so the UI can guide the user.
  await expireSession(sessionData.session_id);
  return transformSessionData({ ...sessionData, recording_state: "expired" }, true);
};

const insertNewSession = async (
  transcriptId: number,
  userId: string,
  orgId: string | null,
  sessionId: string,
  uploadId: string,
  s3Key: string,
  metadata: object
) => {
  await conn.execute(
    `INSERT INTO recording_sessions
     (transcript_id, session_id, user_id, org_id, recording_state, metadata, s3_upload_id, s3_key, chunk_data)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      transcriptId,
      sessionId,
      userId,
      orgId,
      "recording",
      JSON.stringify(metadata),
      uploadId,
      s3Key,
      JSON.stringify({ parts: [] }),
    ]
  );
};

const isDuplicateEntryError = (error: unknown): boolean => {
  if (typeof error === "string") {
    return error.includes("Duplicate entry") && error.includes("uniq_tid");
  }
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") {
      return message.includes("Duplicate entry") && message.includes("uniq_tid");
    }
  }
  return false;
};

const generateSessionId = (): string =>
  `session_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

const createRecordingSession = async (
  transcriptId: number,
  userId: string,
  region: Region
): Promise<RecordingSessionData> => {
  // Check for existing session first
  const existingSession = await getExistingSession(transcriptId, userId);
  if (existingSession) {
    return await handleExistingSession(existingSession);
  }

  // Get org_id from transcript
  const orgId = await getTranscriptOrgId(transcriptId, userId);

  // Create new session
  const s3Key = getUploadKey(transcriptId);
  const { uploadId } = await createS3Upload({
    transcriptId,
    region,
    userId,
    useBiggerPartSize: false,
  });

  const sessionId = generateSessionId();
  const metadata = { region, startTime: Date.now(), mimeType: "audio/webm", totalSize: 0 };

  try {
    await insertNewSession(transcriptId, userId, orgId, sessionId, uploadId, s3Key, metadata);
    return {
      sessionId,
      s3UploadId: uploadId,
      s3Key,
      recordingState: "recording",
      isExisting: false,
    };
  } catch (error: unknown) {
    if (isDuplicateEntryError(error)) {
      const raceConditionSession = await getExistingSession(transcriptId, userId);
      if (raceConditionSession) {
        return await handleExistingSession(raceConditionSession);
      }
    }
    throw error;
  }
};

const handler = async (
  req: NextApiRequest,
  res: NextApiResponse<ApiCreateSessionResponse | { error: string }>
) => {
  const { userId } = getAuth(req);
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" } as any);
  }

  const { transcriptId, region = "us-east-1" } = req.body;

  const result = await createRecordingSession(transcriptId, userId, region);
  return res.status(200).json(result);
};

export default withErrorReporting(handler);
