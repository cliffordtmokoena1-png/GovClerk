import { getAuth } from "@clerk/nextjs/server";
import { NextApiRequest, NextApiResponse } from "next";
import { connect } from "@planetscale/database";
import withErrorReporting from "@/error/withErrorReporting";
import { completeUpload, ApiCompleteUploadResponse } from "../complete-upload";

export type ApiRecorderRecoverResponse = ApiCompleteUploadResponse;

const conn = connect({
  host: process.env.PLANETSCALE_DB_HOST,
  username: process.env.PLANETSCALE_DB_USERNAME,
  password: process.env.PLANETSCALE_DB_PASSWORD,
});

const handler = async (req: NextApiRequest, res: NextApiResponse<ApiRecorderRecoverResponse>) => {
  const { userId } = getAuth(req);
  if (!userId) {
    return res.status(401).json({});
  }

  const { transcriptId } = req.body;

  const result = await conn.execute(
    `SELECT s3_upload_id, chunk_data
     FROM recording_sessions
     WHERE transcript_id = ? AND user_id = ?
     ORDER BY created_at DESC
     LIMIT 1`,
    [transcriptId, userId]
  );

  if (!result.rows.length) {
    throw new Error("No recording session found for this transcript");
  }

  const { s3_upload_id, chunk_data } = result.rows[0] as any;

  const parts = (chunk_data?.parts || []).map((p: any) => ({
    ETag: p.eTag,
    PartNumber: p.partNumber,
  }));

  if (!parts.length) {
    throw new Error("No parts found for multipart upload completion");
  }

  await completeUpload({ transcriptId, uploadId: s3_upload_id, parts, userId, isRecording: true });

  res.status(200).json({});
};

export default withErrorReporting(handler);
