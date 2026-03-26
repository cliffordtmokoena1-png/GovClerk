import { getAuth } from "@clerk/nextjs/server";
import { NextApiRequest, NextApiResponse } from "next";
import { connect } from "@planetscale/database";
import { getPresignedPartUrl } from "../../s3";
import withErrorReporting from "@/error/withErrorReporting";

const conn = connect({
  host: process.env.PLANETSCALE_DB_HOST,
  username: process.env.PLANETSCALE_DB_USERNAME,
  password: process.env.PLANETSCALE_DB_PASSWORD,
});

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const { userId } = getAuth(req);
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { sessionId, partNumber, region } = req.body;

  const result = await conn.execute(
    `SELECT s3_key, s3_upload_id, metadata
     FROM recording_sessions
     WHERE session_id = ? AND user_id = ?`,
    [sessionId, userId]
  );

  if (!result.rows.length) {
    return res.status(404).json({ error: "Recording session not found" });
  }

  const { s3_key, s3_upload_id, metadata } = result.rows[0] as any;

  const resolvedRegion = metadata?.region || region || "us-east-1";

  const presignedUrl = await getPresignedPartUrl(resolvedRegion, s3_key, s3_upload_id, partNumber);

  res.status(200).json({ presignedUrl });
};

export default withErrorReporting(handler);
