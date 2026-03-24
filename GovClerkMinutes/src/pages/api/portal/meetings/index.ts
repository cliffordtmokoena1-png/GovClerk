import withErrorReporting from "@/error/withErrorReporting";
import { getAuth } from "@clerk/nextjs/server";
import { createClerkClient } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { resolveRequestContext } from "@/utils/resolveRequestContext";
import { getClerkKeys } from "@/utils/clerk";

import { errorResponse, jsonResponse } from "@/utils/apiHelpers";
import { formatMySQLDateTime } from "@/utils/dbQueries";
import { getPortalDbConnection, rowToPortalMeeting, rowToPortalArtifact } from "@/utils/portalDb";
import type {
  PortalMeetingWithArtifacts,
  PortalArtifact,
  CreatePortalMeetingRequest,
  PortalMeetingResponse,
} from "@/types/portal";
import { getOrCreatePortalSettings } from "../utils/initializePortalSettings";

interface MeetingsWithArtifactsListResponse {
  meetings: PortalMeetingWithArtifacts[];
  total: number;
  page: number;
  pageSize: number;
}

export const config = {
  runtime: "edge",
};

async function handleGet(orgId: string, searchParams: URLSearchParams): Promise<Response> {
  const conn = getPortalDbConnection();

  const page = parseInt(searchParams.get("page") || "1", 10);
  const pageSize = Math.min(parseInt(searchParams.get("pageSize") || "20", 10), 100);
  const offset = (page - 1) * pageSize;

  const countResult = await conn.execute(
    "SELECT COUNT(*) as total FROM gc_meetings WHERE org_id = ?",
    [orgId]
  );
  const total = parseInt((countResult.rows[0] as any).total, 10);

  const meetingsResult = await conn.execute(
    `SELECT id, org_id, portal_settings_id, board_id, title, description, meeting_date, location,
            is_public, tags, is_cancelled, created_at, updated_at
     FROM gc_meetings WHERE org_id = ? ORDER BY meeting_date DESC LIMIT ? OFFSET ?`,
    [orgId, pageSize, offset]
  );

  const meetings = meetingsResult.rows.map(rowToPortalMeeting);
  const meetingIds = meetings.map((m) => m.id);

  // Fetch artifacts for all meetings in one query
  let artifactsMap: Map<number, PortalArtifact[]> = new Map();
  if (meetingIds.length > 0) {
    const placeholders = meetingIds.map(() => "?").join(",");
    const artifactsResult = await conn.execute(
      `SELECT id, org_id, portal_settings_id, meeting_id, artifact_type, file_name, file_size,
              content_type, s3_key, s3_url, is_public, source_transcript_id, source_agenda_id,
              version, created_at, updated_at
       FROM gc_artifacts
       WHERE meeting_id IN (${placeholders}) AND org_id = ?`,
      [...meetingIds, orgId]
    );

    for (const row of artifactsResult.rows) {
      const artifact = rowToPortalArtifact(row);
      const meetingId = artifact.portalMeetingId!;
      if (!artifactsMap.has(meetingId)) {
        artifactsMap.set(meetingId, []);
      }
      artifactsMap.get(meetingId)!.push(artifact);
    }
  }

  // Combine meetings with their artifacts
  const meetingsWithArtifacts: PortalMeetingWithArtifacts[] = meetings.map((meeting) => ({
    ...meeting,
    artifacts: artifactsMap.get(meeting.id) || [],
  }));

  const response: MeetingsWithArtifactsListResponse = {
    meetings: meetingsWithArtifacts,
    total,
    page,
    pageSize,
  };

  return jsonResponse(response);
}

async function handlePost(
  orgId: string,
  orgSlug: string,
  body: CreatePortalMeetingRequest
): Promise<Response> {
  const conn = getPortalDbConnection();

  // Get or create portal settings for this org
  const settings = await getOrCreatePortalSettings(conn, orgId, orgSlug);
  const mgPortalSettingsId = settings.id;
  const tagsJson = body.tags ? JSON.stringify(body.tags) : null;

  const result = await conn.transaction(async (tx) => {
    const insertResult = await tx.execute(
      `INSERT INTO gc_meetings (
        org_id, portal_settings_id, board_id, title, description, meeting_date, location, is_public,
        tags, is_cancelled
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orgId,
        mgPortalSettingsId,
        body.mgBoardId || null,
        body.title,
        body.description || null,
        formatMySQLDateTime(body.meetingDate),
        body.location || null,
        body.isPublic || false,
        tagsJson,
        body.isCancelled || false,
      ]
    );

    // PlanetScale returns insertId as string
    const id = Number(insertResult.insertId);
    return tx.execute(
      `SELECT id, org_id, portal_settings_id, board_id, title, description, meeting_date, location,
              is_public, tags, is_cancelled, created_at, updated_at
       FROM gc_meetings WHERE id = ?`,
      [id]
    );
  });

  const response: PortalMeetingResponse = {
    meeting: rowToPortalMeeting(result.rows[0]),
  };

  return jsonResponse(response, 201);
}

async function handler(req: NextRequest): Promise<Response> {
  const auth = getAuth(req);
  if (!auth.userId) {
    return errorResponse("Unauthorized", 401);
  }

  const url = new URL(req.url);
  const body = req.method === "GET" ? {} : await req.json().catch(() => ({}));
  const orgIdParam = req.method === "GET" ? url.searchParams.get("orgId") : body.orgId;
  const { orgId, site } = await resolveRequestContext(auth.userId, orgIdParam, req.headers);

  if (!orgId) {
    return errorResponse("Organization context required", 400);
  }

  if (req.method === "GET") {
    return handleGet(orgId, url.searchParams);
  }

  if (req.method === "POST") {
    if (!body.title || !body.meetingDate) {
      return errorResponse("Title and meetingDate are required", 400);
    }

    if (!body.mgBoardId) {
      return errorResponse("Board is required", 400);
    }

    const clerk = createClerkClient(getClerkKeys(site));
    const organization = await clerk.organizations.getOrganization({ organizationId: orgId });

    if (!organization.slug) {
      return errorResponse("Organization does not have a slug configured", 400);
    }

    return handlePost(orgId, organization.slug, body);
  }

  return errorResponse("Method not allowed", 405);
}

export default withErrorReporting(handler);
