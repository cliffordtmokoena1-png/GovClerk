import withErrorReporting from "@/error/withErrorReporting";
import { getAuth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { resolveRequestContext } from "@/utils/resolveRequestContext";
import { errorResponse, jsonResponse } from "@/utils/apiHelpers";
import { getPortalDbConnection } from "@/utils/portalDb";

export const config = {
  runtime: "edge",
};

async function handleGet(meetingId: string, orgId: string): Promise<Response> {
  const conn = getPortalDbConnection();

  const meetingResult = await conn.execute(
    "SELECT id FROM gc_meetings WHERE id = ? AND org_id = ?",
    [meetingId, orgId]
  );

  if (meetingResult.rows.length === 0) {
    return errorResponse("Meeting not found", 404);
  }

  const operationsResult = await conn.execute(
    `SELECT id, meeting_id, operation_type, status, progress_percent, metadata, 
            error_message, started_at, completed_at, created_at, updated_at
     FROM gc_progress_operations
     WHERE meeting_id = ? AND (
       status IN ('pending', 'in_progress') OR 
       completed_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
     )
     ORDER BY created_at DESC`,
    [meetingId]
  );

  const operations = operationsResult.rows.map((row: any) => {
    let parsedMetadata: any = null;
    if (row.metadata) {
      if (typeof row.metadata === "string") {
        try {
          parsedMetadata = JSON.parse(row.metadata);
        } catch {
          parsedMetadata = null;
        }
      } else {
        parsedMetadata = row.metadata;
      }
    }

    return {
      id: row.id,
      meetingId: row.meeting_id,
      operationType: row.operation_type,
      status: row.status,
      progressPercent: row.progress_percent,
      metadata: parsedMetadata,
      errorMessage: row.error_message,
      startedAt: row.started_at ? new Date(row.started_at) : null,
      completedAt: row.completed_at ? new Date(row.completed_at) : null,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  });

  return jsonResponse({ operations });
}

async function handler(req: NextRequest): Promise<Response> {
  const auth = getAuth(req);
  if (!auth.userId) {
    return errorResponse("Unauthorized", 401);
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/");
  const meetingId = pathParts[pathParts.length - 1];

  if (!meetingId) {
    return errorResponse("Meeting ID is required", 400);
  }

  const body = req.method === "GET" ? {} : await req.json().catch(() => ({}));
  const orgIdParam = req.method === "GET" ? url.searchParams.get("orgId") : body.orgId;

  const { orgId } = await resolveRequestContext(auth.userId, orgIdParam, req.headers);

  if (!orgId) {
    return errorResponse("Organization context required", 400);
  }

  if (req.method === "GET") {
    return handleGet(meetingId, orgId);
  }

  return errorResponse("Method not allowed", 405);
}

export default withErrorReporting(handler);
