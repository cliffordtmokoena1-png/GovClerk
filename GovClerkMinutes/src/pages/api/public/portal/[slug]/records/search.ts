/**
 * GET /api/public/portal/[slug]/records/search
 * Full-text search across public meetings, artifacts, and notices.
 * No auth required — accessible to everyone.
 */
import { NextRequest } from "next/server";
import { getPortalDbConnection } from "@/utils/portalDb";
import { errorResponse, jsonResponse } from "@/utils/apiHelpers";
import type { PublicRecordsSearchResponse, PublicRecordsSearchResult } from "@/types/publicRecords";

export const config = {
  runtime: "edge",
};

async function getOrgId(conn: ReturnType<typeof getPortalDbConnection>, slug: string): Promise<string | null> {
  const result = await conn.execute(
    "SELECT org_id FROM gc_portal_settings WHERE slug = ? AND is_enabled = 1",
    [slug]
  );
  if (result.rows.length === 0) return null;
  return (result.rows[0] as any).org_id as string;
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
  const orgId = await getOrgId(conn, slug);
  if (!orgId) {
    return errorResponse("Portal not found", 404);
  }

  const q = url.searchParams.get("q") || "";
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("pageSize") || "20", 10)));
  const offset = (page - 1) * pageSize;
  const typeFilter = url.searchParams.get("type"); // "meeting" | "artifact"
  const startDate = url.searchParams.get("startDate");
  const endDate = url.searchParams.get("endDate");
  const tagsParam = url.searchParams.get("tags");

  const results: PublicRecordsSearchResult[] = [];
  let total = 0;

  const searchPattern = q ? `%${q}%` : "%";

  // Search meetings
  if (!typeFilter || typeFilter === "meeting") {
    let meetingWhere = "org_id = ? AND is_public = 1";
    const meetingParams: any[] = [orgId];

    if (q) {
      meetingWhere += " AND (title LIKE ? OR description LIKE ?)";
      meetingParams.push(searchPattern, searchPattern);
    }
    if (startDate) {
      meetingWhere += " AND meeting_date >= ?";
      meetingParams.push(startDate);
    }
    if (endDate) {
      meetingWhere += " AND meeting_date <= ?";
      meetingParams.push(endDate);
    }
    if (tagsParam) {
      const tags = tagsParam.split(",").filter(Boolean);
      if (tags.length > 0) {
        const tagConditions = tags.map(() => "JSON_CONTAINS(tags, ?)").join(" OR ");
        meetingWhere += ` AND (${tagConditions})`;
        tags.forEach((tag) => meetingParams.push(JSON.stringify(tag)));
      }
    }

    const countRes = await conn.execute(
      `SELECT COUNT(*) as cnt FROM gc_meetings WHERE ${meetingWhere}`,
      meetingParams
    );
    total += parseInt((countRes.rows[0] as any).cnt, 10);

    const meetingsRes = await conn.execute(
      `SELECT id, title, description, meeting_date, tags FROM gc_meetings
       WHERE ${meetingWhere}
       ORDER BY meeting_date DESC
       LIMIT ? OFFSET ?`,
      [...meetingParams, pageSize, offset]
    );

    for (const row of meetingsRes.rows as any[]) {
      let tags: string[] | undefined;
      try {
        tags = typeof row.tags === "string" ? JSON.parse(row.tags) : row.tags;
      } catch {
        tags = undefined;
      }
      results.push({
        id: row.id,
        type: "meeting",
        title: row.title,
        description: row.description || null,
        date: row.meeting_date,
        meetingId: row.id,
        tags,
      });
    }
  }

  // Search artifacts
  if (!typeFilter || typeFilter === "artifact") {
    let artifactWhere = "a.org_id = ? AND a.is_public = 1";
    const artifactParams: any[] = [orgId];

    if (q) {
      artifactWhere += " AND (a.file_name LIKE ? OR m.title LIKE ?)";
      artifactParams.push(searchPattern, searchPattern);
    }
    if (startDate) {
      artifactWhere += " AND m.meeting_date >= ?";
      artifactParams.push(startDate);
    }
    if (endDate) {
      artifactWhere += " AND m.meeting_date <= ?";
      artifactParams.push(endDate);
    }

    const countRes = await conn.execute(
      `SELECT COUNT(*) as cnt FROM gc_artifacts a
       LEFT JOIN gc_meetings m ON m.id = a.meeting_id
       WHERE ${artifactWhere}`,
      artifactParams
    );
    total += parseInt((countRes.rows[0] as any).cnt, 10);

    const artifactsRes = await conn.execute(
      `SELECT a.id, a.file_name, a.artifact_type, a.s3_url, a.meeting_id,
              m.title AS meeting_title, m.meeting_date
       FROM gc_artifacts a
       LEFT JOIN gc_meetings m ON m.id = a.meeting_id
       WHERE ${artifactWhere}
       ORDER BY m.meeting_date DESC
       LIMIT ? OFFSET ?`,
      [...artifactParams, pageSize, offset]
    );

    for (const row of artifactsRes.rows as any[]) {
      results.push({
        id: row.id,
        type: "artifact",
        title: row.file_name,
        description: row.meeting_title || null,
        date: row.meeting_date || "",
        meetingId: row.meeting_id || undefined,
        artifactId: row.id,
        artifactType: row.artifact_type,
        downloadUrl: row.s3_url || undefined,
      });
    }
  }

  const response: PublicRecordsSearchResponse = {
    results,
    total,
    page,
    pageSize,
    query: q,
  };

  return jsonResponse(response);
}
