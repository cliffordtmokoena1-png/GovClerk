import { getAuth } from "@clerk/nextjs/server";
import { NextApiRequest, NextApiResponse } from "next";
import { connect } from "@planetscale/database";
import withErrorReporting from "@/error/withErrorReporting";
import { completeUpload, ApiCompleteUploadResponse } from "../complete-upload";

export type ApiRecorderCompleteUploadResponse = ApiCompleteUploadResponse;

const conn = connect({
  host: process.env.PLANETSCALE_DB_HOST,
  username: process.env.PLANETSCALE_DB_USERNAME,
  password: process.env.PLANETSCALE_DB_PASSWORD,
});

const getSessionData = async (sessionId: string, userId: string) => {
  const result = await conn.execute(
    "SELECT transcript_id, s3_upload_id, chunk_data FROM recording_sessions WHERE session_id = ? AND user_id = ?",
    [sessionId, userId]
  );

  if (!result.rows.length) {
    throw new Error("Recording session not found");
  }

  const { transcript_id, s3_upload_id, chunk_data } = result.rows[0] as any;

  return {
    transcriptId: transcript_id,
    uploadId: s3_upload_id,
    parts: (chunk_data?.parts || []).map((p: any) => ({
      ETag: p.eTag,
      PartNumber: p.partNumber,
    })),
  };
};

const handler = async (
  req: NextApiRequest,
  res: NextApiResponse<ApiRecorderCompleteUploadResponse>
) => {
  const { userId } = getAuth(req);
  if (!userId) {
    return res.status(401).json({});
  }

  const { sessionId } = req.body;

  const { transcriptId, uploadId, parts } = await getSessionData(sessionId, userId);

  if (!parts?.length) {
    throw new Error("No parts found for multipart upload completion");
  }

  await completeUpload({ transcriptId, uploadId, parts, userId, isRecording: true });

  res.status(200).json({});
};

export default withErrorReporting(handler);
