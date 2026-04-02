/**
 * GET /api/public/portal/[slug]/calendar
 * Returns public meetings for a given month/year with notice compliance info.
 * No auth required.
 */
import { NextRequest } from "next/server";
import { getPortalDbConnection } from "@/utils/portalDb";
import { errorResponse, jsonResponse } from "@/utils/apiHelpers";
import type { MeetingCalendarResponse, CalendarMeeting } from "@/types/publicRecords";

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

  const now = new Date();
  const month = Math.min(
    12,
    Math.max(1, parseInt(url.searchParams.get("month") || String(now.getMonth() + 1), 10))
  );
  const year = parseInt(url.searchParams.get("year") || String(now.getFullYear()), 10);

  if (isNaN(month) || isNaN(year)) {
    return errorResponse("Invalid month or year", 400);
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

  // Build date range for the month
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = new Date(year, month, 0); // last day of month
  const endDateStr = endDate.toISOString().split("T")[0];

  const meetingsRes = await conn.execute(
    `SELECT m.id, m.title, m.meeting_date, m.location, m.description, m.tags, m.is_cancelled,
            mn.posted_at AS notice_posted_at, mn.is_compliant,
            (SELECT COUNT(*) FROM gc_artifacts a
             WHERE a.meeting_id = m.id AND a.is_public = 1) AS artifact_count
     FROM gc_meetings m
     LEFT JOIN gc_meeting_notices mn ON mn.meeting_id = m.id AND mn.org_id = m.org_id
     WHERE m.org_id = ? AND m.is_public = 1
       AND m.meeting_date >= ? AND m.meeting_date <= ?
     ORDER BY m.meeting_date ASC`,
    [orgId, startDate, endDateStr]
  );

  const meetings: CalendarMeeting[] = (meetingsRes.rows as any[]).map((row) => {
    let tags: string[] | null = null;
    try {
      tags = typeof row.tags === "string" ? JSON.parse(row.tags) : row.tags;
    } catch {
      tags = null;
    }
    return {
      id: row.id,
      title: row.title,
      meetingDate: row.meeting_date,
      location: row.location || null,
      description: row.description || null,
      tags,
      isCancelled: Boolean(row.is_cancelled),
      hasPublicArtifacts: parseInt(row.artifact_count, 10) > 0,
      noticePostedAt: row.notice_posted_at || null,
      isCompliant: row.is_compliant !== null ? Boolean(row.is_compliant) : null,
    };
  });

  const response: MeetingCalendarResponse = { meetings, month, year };
  return jsonResponse(response);
}
