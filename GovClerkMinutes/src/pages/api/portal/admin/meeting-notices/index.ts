/**
 * GET  /api/portal/admin/meeting-notices — list notices
 * POST /api/portal/admin/meeting-notices — create a meeting notice
 * Requires Clerk auth.
 *
 * POST body: { meetingId, noticeType, postedAt, noticeText?, postingLocation? }
 * Auto-computes hours_notice_given and is_compliant.
 */
import { getAuth } from "@clerk/nextjs/server";
import { NextApiRequest, NextApiResponse } from "next";
import { getPortalDbConnection } from "@/utils/portalDb";

// Required hours of notice per type (minimum)
const NOTICE_HOURS: Record<string, number> = {
  regular: 24,
  special: 72,
  emergency: 1,
  executive_session: 24,
  cancelled: 24,
  rescheduled: 24,
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { userId, orgId } = getAuth(req);
  if (!userId || !orgId) {
    return res.status(401).json({ error: "Unauthorised" });
  }

  const conn = getPortalDbConnection();

  if (req.method === "GET") {
    const { page = "1", pageSize = "20" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page, 10));
    const pageSizeNum = Math.min(100, Math.max(1, parseInt(pageSize, 10)));
    const offset = (pageNum - 1) * pageSizeNum;

    const countRes = await conn.execute(
      "SELECT COUNT(*) as cnt FROM gc_meeting_notices WHERE org_id = ?",
      [orgId]
    );
    const total = parseInt((countRes.rows[0] as any).cnt, 10);

    const result = await conn.execute(
      `SELECT mn.id, mn.meeting_id, mn.notice_type, mn.posted_at, mn.notice_text,
              mn.posting_location, mn.hours_notice_given, mn.is_compliant, mn.created_at,
              m.title AS meeting_title, m.meeting_date
       FROM gc_meeting_notices mn
       JOIN gc_meetings m ON m.id = mn.meeting_id
       WHERE mn.org_id = ?
       ORDER BY m.meeting_date DESC
       LIMIT ? OFFSET ?`,
      [orgId, pageSizeNum, offset]
    );

    return res
      .status(200)
      .json({ notices: result.rows, total, page: pageNum, pageSize: pageSizeNum });
  }

  if (req.method === "POST") {
    const { meetingId, noticeType, postedAt, noticeText, postingLocation } = req.body as {
      meetingId?: number;
      noticeType?: string;
      postedAt?: string;
      noticeText?: string;
      postingLocation?: string;
    };

    if (!meetingId || !noticeType || !postedAt) {
      return res.status(400).json({ error: "meetingId, noticeType, and postedAt are required" });
    }

    // Fetch the meeting date to compute hours notice given
    const meetingRes = await conn.execute(
      "SELECT meeting_date FROM gc_meetings WHERE id = ? AND org_id = ?",
      [meetingId, orgId]
    );
    if (meetingRes.rows.length === 0) {
      return res.status(404).json({ error: "Meeting not found" });
    }
    const meetingDate = new Date((meetingRes.rows[0] as any).meeting_date);
    const postedAtDate = new Date(postedAt);
    const hoursNoticeGiven = Math.floor(
      (meetingDate.getTime() - postedAtDate.getTime()) / (1000 * 60 * 60)
    );
    const minHours = NOTICE_HOURS[noticeType] ?? 24;
    const isCompliant = hoursNoticeGiven >= minHours ? 1 : 0;

    const insertRes = await conn.execute(
      `INSERT INTO gc_meeting_notices
       (org_id, meeting_id, notice_type, posted_at, notice_text, posting_location, hours_notice_given, is_compliant)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orgId,
        meetingId,
        noticeType,
        postedAt,
        noticeText || null,
        postingLocation || null,
        hoursNoticeGiven,
        isCompliant,
      ]
    );

    return res
      .status(201)
      .json({
        success: true,
        id: (insertRes as any).insertId,
        hoursNoticeGiven,
        isCompliant: Boolean(isCompliant),
      });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
