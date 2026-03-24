import withErrorReporting from "@/error/withErrorReporting";
import { connect } from "@planetscale/database";
import { NextRequest } from "next/server";
import type {
  PublicMeetingsListResponse,
  PortalArtifact,
  PortalArtifactType,
} from "@/types/portal";

export const config = {
  runtime: "edge",
};

function getConnection() {
  return connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });
}

async function handler(req: NextRequest): Promise<Response> {
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/");
  // Path: /api/public/portal/[slug]/meetings
  const slugIndex = pathParts.indexOf("portal") + 1;
  const slug = pathParts[slugIndex];

  if (!slug) {
    return new Response(JSON.stringify({ error: "Portal slug is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const conn = getConnection();

  // First verify the portal exists and is enabled
  const portalResult = await conn.execute(
    "SELECT id, org_id FROM gc_portal_settings WHERE slug = ? AND is_enabled = true",
    [slug]
  );

  if (portalResult.rows.length === 0) {
    return new Response(JSON.stringify({ error: "Portal not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const portalSettings = portalResult.rows[0] as any;
  const orgId = portalSettings.org_id;

  // Parse query parameters
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const pageSize = Math.min(parseInt(url.searchParams.get("pageSize") || "20", 10), 100);
  const offset = (page - 1) * pageSize;
  const search = url.searchParams.get("search") || "";
  const startDate = url.searchParams.get("startDate");
  const endDate = url.searchParams.get("endDate");
  const sortBy = url.searchParams.get("sortBy") || "newest";
  const tagsParam = url.searchParams.get("tags");
  const yearParam = url.searchParams.get("year");
  const monthParam = url.searchParams.get("month");

  // Build query conditions
  let whereConditions = "org_id = ? AND is_public = true";
  const queryParams: any[] = [orgId];

  if (search) {
    whereConditions += " AND (title LIKE ? OR description LIKE ?)";
    const searchPattern = `%${search}%`;
    queryParams.push(searchPattern, searchPattern);
  }

  if (startDate) {
    whereConditions += " AND meeting_date >= ?";
    queryParams.push(startDate);
  }

  if (endDate) {
    whereConditions += " AND meeting_date <= ?";
    queryParams.push(endDate);
  }

  // Filter by year and month
  if (yearParam) {
    const year = parseInt(yearParam, 10);
    if (!isNaN(year)) {
      whereConditions += " AND YEAR(meeting_date) = ?";
      queryParams.push(year);
    }
  }

  if (monthParam) {
    const month = parseInt(monthParam, 10);
    if (!isNaN(month) && month >= 1 && month <= 12) {
      whereConditions += " AND MONTH(meeting_date) = ?";
      queryParams.push(month);
    }
  }

  // Filter by tags (JSON array contains check)
  if (tagsParam) {
    const tags = tagsParam.split(",").filter(Boolean);
    if (tags.length > 0) {
      // MySQL JSON_CONTAINS for array membership check
      const tagConditions = tags.map(() => "JSON_CONTAINS(tags, ?)").join(" OR ");
      whereConditions += ` AND (${tagConditions})`;
      tags.forEach((tag) => queryParams.push(JSON.stringify(tag)));
    }
  }

  // Determine sort order
  const orderDirection = sortBy === "oldest" ? "ASC" : "DESC";

  // Get total count
  const countResult = await conn.execute(
    `SELECT COUNT(*) as total FROM gc_meetings WHERE ${whereConditions}`,
    queryParams
  );
  const total = parseInt((countResult.rows[0] as any).total, 10);

  // Get meetings
  const meetingsResult = await conn.execute(
    `SELECT id, title, description, meeting_date, tags, is_cancelled
     FROM gc_meetings
     WHERE ${whereConditions}
     ORDER BY meeting_date ${orderDirection}
     LIMIT ? OFFSET ?`,
    [...queryParams, pageSize, offset]
  );

  // Get meeting IDs for fetching artifacts
  const meetingIds = meetingsResult.rows.map((row: any) => row.id);

  // Fetch artifacts for all meetings in a single query
  let artifactsMap: Map<string, PortalArtifact[]> = new Map();
  if (meetingIds.length > 0) {
    const placeholders = meetingIds.map(() => "?").join(",");
    const artifactsResult = await conn.execute(
      `SELECT id, org_id, meeting_id, artifact_type, file_name, file_size,
              content_type, s3_key, s3_url, is_public, source_transcript_id,
              source_agenda_id, version, created_at, updated_at
       FROM gc_artifacts
       WHERE meeting_id IN (${placeholders}) AND is_public = 1`,
      meetingIds
    );

    for (const row of artifactsResult.rows as any[]) {
      const meetingId = row.meeting_id;
      if (!artifactsMap.has(meetingId)) {
        artifactsMap.set(meetingId, []);
      }
      artifactsMap.get(meetingId)!.push({
        id: row.id,
        orgId: row.org_id,
        portalMeetingId: row.meeting_id,
        artifactType: row.artifact_type as PortalArtifactType,
        fileName: row.file_name,
        fileSize: row.file_size,
        contentType: row.content_type,
        s3Key: row.s3_key,
        s3Url: row.s3_url,
        isPublic: Boolean(row.is_public),
        sourceTranscriptId: row.source_transcript_id,
        sourceAgendaId: row.source_agenda_id,
        version: row.version,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      });
    }
  }

  const meetings = meetingsResult.rows.map((row: any) => {
    let tags: string[] | undefined;
    if (row.tags) {
      try {
        tags = typeof row.tags === "string" ? JSON.parse(row.tags) : row.tags;
      } catch {
        tags = undefined;
      }
    }

    return {
      id: row.id,
      title: row.title,
      description: row.description,
      meetingDate: row.meeting_date,
      tags,
      isCancelled: Boolean(row.is_cancelled),
      artifacts: artifactsMap.get(row.id) || [],
    };
  });

  const response: PublicMeetingsListResponse = {
    meetings,
    total,
    page,
    pageSize,
  };

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

export default withErrorReporting(handler);
