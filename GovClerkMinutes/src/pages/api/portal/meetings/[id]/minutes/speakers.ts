import withErrorReporting from "@/error/withErrorReporting";
import { getAuth } from "@clerk/nextjs/server";
import type { NextApiRequest, NextApiResponse } from "next";
import { resolveRequestContext } from "@/utils/resolveRequestContext";
import { getPortalDbConnection } from "@/utils/portalDb";

export const config = {
  runtime: "nodejs",
};

async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  const auth = getAuth(req);
  if (!auth.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const meetingId = req.query.id as string;
  if (!meetingId) {
    res.status(400).json({ error: "Meeting ID is required" });
    return;
  }

  const conn = getPortalDbConnection();

  if (req.method === "GET") {
    const orgIdParam = req.query.orgId as string | undefined;
    const { orgId } = await resolveRequestContext(auth.userId, orgIdParam, req.headers);

    if (!orgId) {
      res.status(400).json({ error: "Organization context required" });
      return;
    }

    // Verify meeting belongs to org
    const meetingCheck = await conn.execute(
      "SELECT id FROM gc_meetings WHERE id = ? AND org_id = ?",
      [meetingId, orgId]
    );
    if (meetingCheck.rows.length === 0) {
      res.status(404).json({ error: "Meeting not found" });
      return;
    }

    try {
      const result = await conn.execute(
        "SELECT speakers FROM gc_meeting_expected_speakers WHERE meeting_id = ? AND org_id = ? LIMIT 1",
        [meetingId, orgId]
      );
      if (result.rows.length === 0) {
        res.status(200).json({ speakers: [] });
        return;
      }
      const row = result.rows[0] as { speakers: string };
      const speakers: string[] = JSON.parse(row.speakers || "[]");
      res.status(200).json({ speakers });
    } catch {
      // Table might not exist yet
      res.status(200).json({ speakers: [] });
    }
    return;
  }

  if (req.method === "POST") {
    const body = req.body || {};
    const { orgId } = await resolveRequestContext(auth.userId, body.orgId, req.headers);

    if (!orgId) {
      res.status(400).json({ error: "Organization context required" });
      return;
    }

    const speakers: string[] = body.speakers || [];
    if (!Array.isArray(speakers)) {
      res.status(400).json({ error: "speakers must be an array" });
      return;
    }

    // Sanitize speaker names
    const cleanedSpeakers = speakers
      .map((s) => String(s).trim())
      .filter((s) => s.length > 0)
      .slice(0, 50); // reasonable limit

    // Verify meeting belongs to org
    const meetingCheck = await conn.execute(
      "SELECT id FROM gc_meetings WHERE id = ? AND org_id = ?",
      [meetingId, orgId]
    );
    if (meetingCheck.rows.length === 0) {
      res.status(404).json({ error: "Meeting not found" });
      return;
    }

    try {
      // Upsert expected speakers
      await conn.execute(
        `INSERT INTO gc_meeting_expected_speakers (meeting_id, org_id, speakers, created_at, updated_at)
         VALUES (?, ?, ?, NOW(), NOW())
         ON DUPLICATE KEY UPDATE speakers = VALUES(speakers), updated_at = NOW()`,
        [meetingId, orgId, JSON.stringify(cleanedSpeakers)]
      );
    } catch (dbError) {
      // Table might not exist — log and continue gracefully
      console.warn("[speakers] Could not save expected speakers (table may not exist):", dbError);
    }

    res.status(200).json({ success: true, speakers: cleanedSpeakers });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}

export default withErrorReporting(handler);
