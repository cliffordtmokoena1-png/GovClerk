/**
 * GET /api/public/portal/[slug]/feed
 * RSS 2.0 feed of recently published public meetings and documents.
 * No auth required.
 */
import { NextRequest } from "next/server";
import { getPortalDbConnection } from "@/utils/portalDb";
import { errorResponse } from "@/utils/apiHelpers";

export const config = {
  runtime: "edge",
};

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toRssDate(dateStr: string): string {
  return new Date(dateStr).toUTCString();
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
    "SELECT org_id, page_title, page_description FROM gc_portal_settings WHERE slug = ? AND is_enabled = 1",
    [slug]
  );
  if (settingsRes.rows.length === 0) {
    return errorResponse("Portal not found", 404);
  }
  const {
    org_id: orgId,
    page_title: pageTitle,
    page_description: portalDesc,
  } = settingsRes.rows[0] as any;

  const meetingsRes = await conn.execute(
    `SELECT id, title, description, meeting_date, created_at
     FROM gc_meetings
     WHERE org_id = ? AND is_public = 1
     ORDER BY meeting_date DESC
     LIMIT 20`,
    [orgId]
  );

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://govclerkminutes.com";
  const channelTitle = escapeXml(pageTitle || "Public Meetings");
  const channelDesc = escapeXml(portalDesc || `Public meeting records for ${pageTitle || slug}`);
  const channelLink = `${appUrl}/portal/${slug}`;

  const items = (meetingsRes.rows as any[])
    .map((row) => {
      const title = escapeXml(row.title || "Meeting");
      const link = `${appUrl}/portal/${slug}/meetings/${row.id}`;
      const desc = escapeXml(row.description || "");
      const pubDate = toRssDate(row.meeting_date || row.created_at);
      const guid = `${appUrl}/portal/${slug}/meetings/${row.id}`;
      return `    <item>
      <title>${title}</title>
      <link>${link}</link>
      <description>${desc}</description>
      <pubDate>${pubDate}</pubDate>
      <guid isPermaLink="true">${guid}</guid>
    </item>`;
    })
    .join("\n");

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${channelTitle}</title>
    <link>${channelLink}</link>
    <description>${channelDesc}</description>
    <language>en</language>
    <atom:link href="${appUrl}/api/public/portal/${slug}/feed" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`;

  return new Response(rss, {
    status: 200,
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
