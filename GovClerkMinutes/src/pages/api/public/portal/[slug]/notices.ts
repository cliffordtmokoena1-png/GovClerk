/**
 * GET /api/public/portal/[slug]/notices
 * Returns meeting notices for upcoming and recent meetings.
 * No auth required.
 */
import { NextRequest } from "next/server";
import { getPortalDbConnection } from "@/utils/portalDb";
import { errorResponse, jsonResponse } from "@/utils/apiHelpers";

export const config = {
  runtime: "edge",
};

export default async function handler(req: NextRequest): Promise<Response> {
  if (req.method !== "GET") {
    return errorResponse("Method not allowed", 405);
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/");
  const slugIndex = pathParts.indexOf("portal") + 1;
  const slug = pathParts[slugIndex];

  if (!slug) {
    return errorResponse("Portal slug is required", 400);
  }

  const conn = getPortalDbConnection();

  const settingsRes = await conn.execute(
    "SELECT org_id FROM gc_portal_settings WHERE slug = ? AND is_enabled = 1",
    [slug]
  );
  if (settingsRes.rows.length === 0) {
    return errorResponse("Portal not found", 404);
  }
  const orgId = (settingsRes.rows[0] as any).org_id as string;

  const upcomingOnly = url.searchParams.get("upcoming") === "true";
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const pageSize = Math.min(50, Math.max(1, parseInt(url.searchParams.get("pageSize") || "20", 10)));
  const offset = (page - 1) * pageSize;

  let dateFilter = "";
  if (upcomingOnly) {
    dateFilter = "AND m.meeting_date >= CURDATE()";
  }

  const countRes = await conn.execute(
    `SELECT COUNT(*) as cnt
     FROM gc_meeting_notices mn
     JOIN gc_meetings m ON m.id = mn.meeting_id
     WHERE mn.org_id = ? AND m.is_public = 1 ${dateFilter}`,
    [orgId]
  );
  const total = parseInt((countRes.rows[0] as any).cnt, 10);

  const noticesRes = await conn.execute(
    `SELECT mn.id, mn.meeting_id, mn.notice_type, mn.posted_at, mn.notice_text,
            mn.posting_location, mn.hours_notice_given, mn.is_compliant,
            m.title AS meeting_title, m.meeting_date
     FROM gc_meeting_notices mn
     JOIN gc_meetings m ON m.id = mn.meeting_id
     WHERE mn.org_id = ? AND m.is_public = 1 ${dateFilter}
     ORDER BY m.meeting_date DESC
     LIMIT ? OFFSET ?`,
    [orgId, pageSize, offset]
  );

  const notices = (noticesRes.rows as any[]).map((row) => ({
    id: row.id,
    meetingId: row.meeting_id,
    meetingTitle: row.meeting_title,
    meetingDate: row.meeting_date,
    noticeType: row.notice_type,
    postedAt: row.posted_at,
    noticeText: row.notice_text || null,
    postingLocation: row.posting_location || null,
    hoursNoticeGiven: row.hours_notice_given !== null ? Number(row.hours_notice_given) : null,
    isCompliant: row.is_compliant !== null ? Boolean(row.is_compliant) : null,
  }));

  return jsonResponse({ notices, total, page, pageSize });
}
