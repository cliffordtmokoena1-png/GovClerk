/**
 * Portal-session-authenticated broadcast endpoint.
 *
 * GET    /api/public/portal/[slug]/admin/broadcast
 *        → Returns the current active/setup/paused broadcast for this org (or null).
 *          Also returns the list of org meetings for the meeting selector.
 *
 * POST   /api/public/portal/[slug]/admin/broadcast
 *        → Creates a new broadcast row in gc_broadcasts.
 *          Body: { meetingId?: number, title?: string }
 *          Sets status='setup', generates a random 32-char hex stream key.
 *          Requires an active or trial subscription (isGovClerkAdmin bypasses).
 *
 * PUT    /api/public/portal/[slug]/admin/broadcast
 *        → Updates broadcast status.
 *          Body: { broadcastId: number, status: 'live' | 'paused' | 'ended' | 'setup' }
 *          When status='ended', sets ended_at = UTC_TIMESTAMP().
 *
 * DELETE /api/public/portal/[slug]/admin/broadcast
 *        → Cancels/deletes a broadcast that is still in 'setup' status.
 *          Body: { broadcastId: number }
 *
 * Only portal users with role='admin' may access this endpoint.
 * Uses portal auth (gc_portal_sessions), NOT Clerk auth.
 */

import { NextRequest } from "next/server";
import { getPortalDbConnection } from "@/utils/portalDb";
import { getPortalSession, isGovClerkAdmin } from "@/portal-auth/portalAuth";
import { jsonResponse, errorResponse } from "@/utils/apiHelpers";

export const config = {
  runtime: "edge",
};

/** Generate a cryptographically random 32-character hex stream key. */
function generateStreamKey(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function resolveAdminOrgId(
  req: NextRequest
): Promise<{ orgId: string; slug: string } | Response> {
  const session = await getPortalSession(req);
  if (!session) {
    return errorResponse("Unauthorized", 401);
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/");
  const portalIndex = pathParts.indexOf("portal");
  const slug = portalIndex >= 0 ? pathParts[portalIndex + 1] : null;

  if (!slug) {
    return errorResponse("Portal slug is required", 400);
  }

  const conn = getPortalDbConnection();

  const settingsResult = await conn.execute(
    "SELECT org_id FROM gc_portal_settings WHERE slug = ?",
    [slug]
  );
  if (settingsResult.rows.length === 0) {
    return errorResponse("Portal not found", 404);
  }
  const orgId = (settingsResult.rows[0] as any).org_id;

  // GovClerk admins bypass all org and role checks
  if (isGovClerkAdmin(session.email)) {
    return { orgId, slug };
  }

  if (orgId !== session.orgId) {
    return errorResponse("Forbidden", 403);
  }

  if (!session.portalUserId) {
    return errorResponse("Admin access required", 403);
  }
  const userResult = await conn.execute(
    "SELECT role FROM gc_portal_users WHERE id = ? AND org_id = ?",
    [session.portalUserId, orgId]
  );
  if (userResult.rows.length === 0) {
    return errorResponse("User not found", 404);
  }
  if ((userResult.rows[0] as any).role !== "admin") {
    return errorResponse("Admin role required", 403);
  }

  return { orgId, slug };
}

function rowToBroadcast(row: any) {
  return {
    id: Number(row.id),
    orgId: row.org_id,
    meetingId: row.meeting_id != null ? Number(row.meeting_id) : null,
    title: row.title ?? null,
    status: row.status,
    streamKey: row.stream_key ?? null,
    startedAt: row.started_at ?? null,
    endedAt: row.ended_at ?? null,
    createdAt: row.created_at,
  };
}

export default async function handler(req: NextRequest): Promise<Response> {
  const resolved = await resolveAdminOrgId(req);
  if (resolved instanceof Response) { return resolved; }
  const { orgId } = resolved;

  const conn = getPortalDbConnection();

  // ── GET ─────────────────────────────────────────────────────────────────────
  if (req.method === "GET") {
    const [broadcastResult, meetingsResult] = await Promise.all([
      conn.execute(
        `SELECT id, org_id, meeting_id, title, status, stream_key, started_at, ended_at, created_at
         FROM gc_broadcasts
         WHERE org_id = ? AND status IN ('setup', 'live', 'paused')
         ORDER BY created_at DESC
         LIMIT 1`,
        [orgId]
      ),
      conn.execute(
        `SELECT id, title FROM gc_meetings
         WHERE org_id = ?
         ORDER BY created_at DESC
         LIMIT 50`,
        [orgId]
      ),
    ]);

    const broadcast =
      broadcastResult.rows.length > 0
        ? rowToBroadcast(broadcastResult.rows[0] as any)
        : null;

    const meetings = meetingsResult.rows.map((row: any) => ({
      id: Number(row.id),
      title: row.title,
    }));

    return jsonResponse({ broadcast, meetings });
  }

  // ── POST ─────────────────────────────────────────────────────────────────────
  if (req.method === "POST") {
    // Check for an existing active/setup/paused broadcast
    const existingResult = await conn.execute(
      `SELECT id FROM gc_broadcasts
       WHERE org_id = ? AND status IN ('setup', 'live', 'paused')
       LIMIT 1`,
      [orgId]
    );
    if (existingResult.rows.length > 0) {
      return errorResponse("An active broadcast already exists for this org", 409);
    }

    // Subscription gate: require active or trial subscription (GovClerk admins bypass)
    const session = await getPortalSession(req);
    if (!isGovClerkAdmin(session?.email)) {
      const subResult = await conn.execute(
        `SELECT id FROM gc_portal_subscriptions
         WHERE org_id = ? AND status IN ('active', 'trial')
         LIMIT 1`,
        [orgId]
      );
      if (subResult.rows.length === 0) {
        return errorResponse(
          "A Live plan subscription is required to create broadcasts",
          402
        );
      }
    }

    const body = await req.json().catch(() => ({}));
    const { meetingId, title } = body as {
      meetingId?: number;
      title?: string;
    };

    const streamKey = generateStreamKey();

    await conn.execute(
      `INSERT INTO gc_broadcasts
         (org_id, meeting_id, title, status, stream_key, created_at, updated_at)
       VALUES (?, ?, ?, 'setup', ?, UTC_TIMESTAMP(), UTC_TIMESTAMP())`,
      [orgId, meetingId ?? null, title ?? null, streamKey]
    );

    const createdResult = await conn.execute(
      `SELECT id, org_id, meeting_id, title, status, stream_key, started_at, ended_at, created_at
       FROM gc_broadcasts
       WHERE org_id = ? AND status = 'setup'
       ORDER BY created_at DESC
       LIMIT 1`,
      [orgId]
    );

    const broadcast =
      createdResult.rows.length > 0
        ? rowToBroadcast(createdResult.rows[0] as any)
        : null;

    return jsonResponse({ broadcast }, 201);
  }

  // ── PUT ──────────────────────────────────────────────────────────────────────
  if (req.method === "PUT") {
    const body = await req.json().catch(() => ({}));
    const { broadcastId, status } = body as {
      broadcastId?: number;
      status?: string;
    };

    if (!broadcastId) {
      return errorResponse("broadcastId is required", 400);
    }

    const validStatuses = ["setup", "live", "paused", "ended"];
    if (!status || !validStatuses.includes(status)) {
      return errorResponse("Invalid status. Must be one of: setup, live, paused, ended", 400);
    }

    // Verify the broadcast belongs to this org
    const checkResult = await conn.execute(
      "SELECT id FROM gc_broadcasts WHERE id = ? AND org_id = ?",
      [broadcastId, orgId]
    );
    if (checkResult.rows.length === 0) {
      return errorResponse("Broadcast not found", 404);
    }

    if (status === "ended") {
      await conn.execute(
        `UPDATE gc_broadcasts
         SET status = 'ended', ended_at = UTC_TIMESTAMP(), updated_at = UTC_TIMESTAMP()
         WHERE id = ? AND org_id = ?`,
        [broadcastId, orgId]
      );
    } else if (status === "live") {
      await conn.execute(
        `UPDATE gc_broadcasts
         SET status = 'live', started_at = COALESCE(started_at, UTC_TIMESTAMP()), updated_at = UTC_TIMESTAMP()
         WHERE id = ? AND org_id = ?`,
        [broadcastId, orgId]
      );
    } else {
      await conn.execute(
        `UPDATE gc_broadcasts
         SET status = ?, updated_at = UTC_TIMESTAMP()
         WHERE id = ? AND org_id = ?`,
        [status, broadcastId, orgId]
      );
    }

    const updatedResult = await conn.execute(
      `SELECT id, org_id, meeting_id, title, status, stream_key, started_at, ended_at, created_at
       FROM gc_broadcasts
       WHERE id = ? AND org_id = ?`,
      [broadcastId, orgId]
    );

    const broadcast =
      updatedResult.rows.length > 0
        ? rowToBroadcast(updatedResult.rows[0] as any)
        : null;

    return jsonResponse({ broadcast });
  }

  // ── DELETE ───────────────────────────────────────────────────────────────────
  if (req.method === "DELETE") {
    const body = await req.json().catch(() => ({}));
    const { broadcastId } = body as { broadcastId?: number };

    if (!broadcastId) {
      return errorResponse("broadcastId is required", 400);
    }

    // Only allow deleting broadcasts that are still in 'setup' status
    const checkResult = await conn.execute(
      "SELECT id, status FROM gc_broadcasts WHERE id = ? AND org_id = ?",
      [broadcastId, orgId]
    );
    if (checkResult.rows.length === 0) {
      return errorResponse("Broadcast not found", 404);
    }
    if ((checkResult.rows[0] as any).status !== "setup") {
      return errorResponse("Only broadcasts in 'setup' status can be cancelled", 400);
    }

    await conn.execute(
      "DELETE FROM gc_broadcasts WHERE id = ? AND org_id = ? AND status = 'setup'",
      [broadcastId, orgId]
    );

    return jsonResponse({ success: true });
  }

  return errorResponse("Method not allowed", 405);
}
