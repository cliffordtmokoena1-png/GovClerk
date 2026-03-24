import { getAuth } from "@clerk/nextjs/server";
import { NextApiRequest, NextApiResponse } from "next";
import { connect } from "@planetscale/database";
import withErrorReporting from "@/error/withErrorReporting";

const conn = connect({
  host: process.env.PLANETSCALE_DB_HOST,
  username: process.env.PLANETSCALE_DB_USERNAME,
  password: process.env.PLANETSCALE_DB_PASSWORD,
});

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ success: boolean } | { error: string }>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { userId } = getAuth(req);
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { transcriptId, segmentStart, segmentStop, newSpeakerLabel } = req.body;

    if (!transcriptId || !segmentStart || !segmentStop || !newSpeakerLabel) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const transcriptRows = await conn
      .execute("SELECT id FROM transcripts WHERE id = ? AND userId = ?", [transcriptId, userId])
      .then((result) => result.rows);

    if (transcriptRows.length === 0) {
      return res.status(404).json({ error: "Transcript not found" });
    }

    const speakerRows = await conn
      .execute("SELECT id FROM speakers WHERE label = ? AND transcriptId = ? AND userId = ?", [
        newSpeakerLabel,
        transcriptId,
        userId,
      ])
      .then((result) => result.rows);

    if (speakerRows.length === 0) {
      return res.status(404).json({ error: "Speaker label not found" });
    }

    const updateResult = await conn.execute(
      `UPDATE gc_segments
       SET speaker = ?
       WHERE transcript_id = ?
         AND start = ?
         AND stop = ?`,
      [newSpeakerLabel, transcriptId, segmentStart, segmentStop]
    );

    if (updateResult.rowsAffected === 0) {
      return res.status(404).json({ error: "Segment not found" });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error in relabel-segment:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export default withErrorReporting(handler);
