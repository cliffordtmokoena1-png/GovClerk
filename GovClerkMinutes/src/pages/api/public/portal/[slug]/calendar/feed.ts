/**
 * GET /api/public/portal/[slug]/calendar/feed
 * Returns an iCal (.ics) formatted calendar feed (RFC 5545).
 * Used for calendar subscription (Google Calendar, Apple Calendar, Outlook).
 * No auth required.
 */
import { NextRequest } from "next/server";
import { getPortalDbConnection } from "@/utils/portalDb";
import { errorResponse } from "@/utils/apiHelpers";

export const config = {
  runtime: "edge",
};

function escapeIcal(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function formatIcalDate(dateStr: string): string {
  // dateStr is either "YYYY-MM-DD" or "YYYY-MM-DD HH:MM:SS"
  const d = new Date(dateStr);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

function formatIcalDateOnly(dateStr: string): string {
  const d = new Date(dateStr);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
}

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
    "SELECT org_id, page_title FROM gc_portal_settings WHERE slug = ? AND is_enabled = 1",
    [slug]
  );
  if (settingsRes.rows.length === 0) {
    return errorResponse("Portal not found", 404);
  }
  const { org_id: orgId, page_title: pageTitle } = settingsRes.rows[0] as any;

  // Fetch upcoming and recent meetings (next 12 months and last 3 months)
  const meetingsRes = await conn.execute(
    `SELECT id, title, meeting_date, location, description
     FROM gc_meetings
     WHERE org_id = ? AND is_public = 1
       AND meeting_date >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)
       AND meeting_date <= DATE_ADD(CURDATE(), INTERVAL 12 MONTH)
     ORDER BY meeting_date ASC
     LIMIT 200`,
    [orgId]
  );

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://govclerkminutes.com";
  const calName = escapeIcal(pageTitle || "Public Meetings");
  const now = formatIcalDate(new Date().toISOString());

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//GovClerkMinutes//Public Portal//EN`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${calName}`,
    `X-WR-CALDESC:Public meeting calendar for ${calName}`,
    "X-WR-TIMEZONE:UTC",
  ];

  for (const row of meetingsRes.rows as any[]) {
    const uid = `meeting-${row.id}@govclerkminutes.com`;
    const title = escapeIcal(row.title || "Meeting");
    const location = row.location ? escapeIcal(row.location) : "";
    const description = row.description ? escapeIcal(row.description) : "";
    const meetingUrl = `${appUrl}/portal/${slug}/meetings/${row.id}`;
    const dtstart = `DTSTART;VALUE=DATE:${formatIcalDateOnly(row.meeting_date)}`;

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${now}`);
    lines.push(dtstart);
    lines.push(`SUMMARY:${title}`);
    if (location) lines.push(`LOCATION:${location}`);
    if (description) lines.push(`DESCRIPTION:${description}`);
    lines.push(`URL:${meetingUrl}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  const ical = lines.join("\r\n");

  return new Response(ical, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}-meetings.ics"`,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
