import { getAuth } from "@clerk/nextjs/server";
import { NextApiRequest, NextApiResponse } from "next";
import { connect } from "@planetscale/database";
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

  const { sessionId, partNumber, eTag, chunkSize } = req.body;

  const result = await conn.execute(
    "SELECT metadata, chunk_data, transcript_id FROM recording_sessions WHERE session_id = ? AND user_id = ?",
    [sessionId, userId]
  );

  if (!result.rows.length) {
    return res.status(404).json({ error: "Recording session not found" });
  }

  const { chunk_data, metadata, transcript_id } = result.rows[0] as any;
  const parts = Array.isArray(chunk_data?.parts) ? chunk_data.parts : [];

  parts.push({
    partNumber,
    eTag,
    uploadedAt: new Date().toISOString(),
  });

  const totalSize = metadata.totalSize + chunkSize;

  await conn.execute(
    `UPDATE recording_sessions AS rs
   JOIN transcripts AS t
     ON t.id = ?
   SET
     rs.chunk_data            = ?,
     rs.metadata              = JSON_SET(rs.metadata, '$.totalSize', ?),
     rs.updated_at            = UTC_TIMESTAMP(),
     t.file_size              = ?
   WHERE
     rs.session_id = ? AND
     rs.user_id    = ?`,
    [transcript_id, JSON.stringify({ parts }), totalSize, totalSize, sessionId, userId]
  );

  res.status(200).json({ success: true });
};

export default withErrorReporting(handler);
