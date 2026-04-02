/**
 * Portal-session-authenticated member management endpoints.
 *
 * PUT    /api/public/portal/[slug]/admin/members/[userId] — Update role, isActive, name
 * DELETE /api/public/portal/[slug]/admin/members/[userId] — Soft-delete (set is_active = 0)
 *
 * Only portal users with role='admin' may access these endpoints.
 */

import { NextRequest } from "next/server";
import { getPortalDbConnection } from "@/utils/portalDb";
import { getPortalSession } from "@/portal-auth/portalAuth";
import { jsonResponse, errorResponse } from "@/utils/apiHelpers";
import type { PortalUser } from "@/types/portal";

export const config = {
  runtime: "edge",
};

function rowToPortalUser(row: any): PortalUser {
  return {
    id: row.id,
    orgId: row.org_id,
    email: row.email,
    firstName: row.first_name ?? null,
    lastName: row.last_name ?? null,
    role: row.role,
    emailDomain: row.email_domain ?? "",
    isActive: Boolean(row.is_active),
    lastLoginAt: row.last_login_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export default async function handler(req: NextRequest): Promise<Response> {
  // Validate portal session
  const session = await getPortalSession(req);
  if (!session) {
    return errorResponse("Unauthorized", 401);
  }

  // Extract slug and userId from URL path:
  // /api/public/portal/[slug]/admin/members/[userId]
  const url = new URL(req.url);
  const pathParts = url.pathname.split("/");
  const portalIndex = pathParts.indexOf("portal");
  const slug = portalIndex >= 0 ? pathParts[portalIndex + 1] : null;
  const membersIndex = pathParts.indexOf("members");
  const userId = membersIndex >= 0 ? pathParts[membersIndex + 1] : null;

  if (!slug) {
    return errorResponse("Portal slug is required", 400);
  }
  if (!userId || isNaN(Number(userId))) {
    return errorResponse("Valid user ID is required", 400);
  }

  const conn = getPortalDbConnection();

  // Verify slug matches session orgId
  const settingsResult = await conn.execute(
    "SELECT org_id FROM gc_portal_settings WHERE slug = ? AND is_enabled = 1",
    [slug]
  );
  if (settingsResult.rows.length === 0) {
    return errorResponse("Portal not found", 404);
  }
  const orgId = (settingsResult.rows[0] as any).org_id;
  if (orgId !== session.orgId) {
    return errorResponse("Forbidden", 403);
  }

  // Check that the requesting portal user has admin role
  if (!session.portalUserId) {
    return errorResponse("Admin access required", 403);
  }
  const adminResult = await conn.execute(
    "SELECT role FROM gc_portal_users WHERE id = ? AND org_id = ?",
    [session.portalUserId, orgId]
  );
  if (adminResult.rows.length === 0) {
    return errorResponse("User not found", 404);
  }
  if ((adminResult.rows[0] as any).role !== "admin") {
    return errorResponse("Admin role required", 403);
  }

  const targetUserId = Number(userId);

  if (req.method === "PUT") {
    let body: {
      role?: string;
      isActive?: boolean;
      firstName?: string;
      lastName?: string;
    };
    try {
      body = await req.json();
    } catch {
      return errorResponse("Invalid request body", 400);
    }

    const { role, isActive, firstName, lastName } = body;

    if (role !== undefined && !["admin", "member", "readonly"].includes(role)) {
      return errorResponse("Invalid role. Must be admin, member, or readonly", 400);
    }

    // Build dynamic SET clause
    const setClauses: string[] = [];
    const params: any[] = [];

    if (role !== undefined) {
      setClauses.push("role = ?");
      params.push(role);
    }
    if (isActive !== undefined) {
      setClauses.push("is_active = ?");
      params.push(isActive ? 1 : 0);
    }
    if (firstName !== undefined) {
      setClauses.push("first_name = ?");
      params.push(firstName || null);
    }
    if (lastName !== undefined) {
      setClauses.push("last_name = ?");
      params.push(lastName || null);
    }

    if (setClauses.length === 0) {
      return errorResponse("No fields to update", 400);
    }

    params.push(targetUserId, orgId);
    await conn.execute(
      `UPDATE gc_portal_users SET ${setClauses.join(", ")} WHERE id = ? AND org_id = ?`,
      params
    );

    const updatedResult = await conn.execute(
      `SELECT id, org_id, email, first_name, last_name, role, email_domain,
              is_active, last_login_at, created_at, updated_at
       FROM gc_portal_users WHERE id = ? AND org_id = ?`,
      [targetUserId, orgId]
    );

    if (updatedResult.rows.length === 0) {
      return errorResponse("User not found", 404);
    }

    return jsonResponse({ user: rowToPortalUser(updatedResult.rows[0] as any) });
  }

  if (req.method === "DELETE") {
    // Verify user exists before deactivating
    const targetUser = await conn.execute(
      "SELECT id FROM gc_portal_users WHERE id = ? AND org_id = ?",
      [targetUserId, orgId]
    );
    if (targetUser.rows.length === 0) {
      return errorResponse("User not found", 404);
    }

    // Atomically soft-delete only if currently active, then check affected rows
    // to avoid double-decrementing seats_used in concurrent requests.
    const updateResult = await conn.execute(
      "UPDATE gc_portal_users SET is_active = 0 WHERE id = ? AND org_id = ? AND is_active = 1",
      [targetUserId, orgId]
    );

    // Only decrement seats_used if we actually changed an active row
    if ((updateResult as any).rowsAffected > 0) {
      await conn.execute(
        `UPDATE gc_portal_subscriptions
         SET seats_used = GREATEST(0, seats_used - 1)
         WHERE org_id = ?`,
        [orgId]
      );
    }

    return jsonResponse({ success: true });
  }

  return errorResponse("Method not allowed", 405);
}
