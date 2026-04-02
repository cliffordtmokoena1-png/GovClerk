/**
 * Admin portal user management — single user endpoints (Clerk-authed).
 *
 * PUT    /api/portal/auth/users/[userId] — Update user (role, is_active, name)
 * DELETE /api/portal/auth/users/[userId] — Deactivate user
 */

import { NextRequest } from "next/server";
import { getAuth } from "@clerk/nextjs/server";
import { getPortalDbConnection } from "@/utils/portalDb";
import { errorResponse, jsonResponse } from "@/utils/apiHelpers";
import { resolveRequestContext } from "@/utils/resolveRequestContext";
import type { PortalUser, PortalUserRole } from "@/types/portal";

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
    emailDomain: row.email_domain,
    isActive: Boolean(row.is_active),
    lastLoginAt: row.last_login_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export default async function handler(req: NextRequest): Promise<Response> {
  const auth = getAuth(req);
  if (!auth.userId) {
    return errorResponse("Unauthorized", 401);
  }

  // Only admins can manage users
  const sessionClaims = auth.sessionClaims as any;
  if (sessionClaims?.metadata?.role !== "admin") {
    return errorResponse("Admin role required", 403);
  }

  const { orgId } = await resolveRequestContext(auth.userId, null, req.headers);
  if (!orgId) {
    return errorResponse("Organization context required", 400);
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/");
  const userId = pathParts[pathParts.length - 1];
  if (!userId || isNaN(Number(userId))) {
    return errorResponse("Valid userId is required", 400);
  }

  const conn = getPortalDbConnection();

  // Ensure the user belongs to this org
  const userCheck = await conn.execute(
    "SELECT id FROM gc_portal_users WHERE id = ? AND org_id = ?",
    [userId, orgId]
  );
  if (userCheck.rows.length === 0) {
    return errorResponse("User not found", 404);
  }

  if (req.method === "PUT") {
    let body: { role?: PortalUserRole; isActive?: boolean; firstName?: string; lastName?: string };
    try {
      body = await req.json();
    } catch {
      return errorResponse("Invalid request body", 400);
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (body.role !== undefined) {
      if (!["admin", "member", "readonly"].includes(body.role)) {
        return errorResponse("Invalid role", 400);
      }
      updates.push("role = ?");
      params.push(body.role);
    }
    if (body.isActive !== undefined) {
      updates.push("is_active = ?");
      params.push(body.isActive ? 1 : 0);
    }
    if (body.firstName !== undefined) {
      updates.push("first_name = ?");
      params.push(body.firstName);
    }
    if (body.lastName !== undefined) {
      updates.push("last_name = ?");
      params.push(body.lastName);
    }

    if (updates.length === 0) {
      return errorResponse("No fields to update", 400);
    }

    params.push(userId, orgId);
    await conn.execute(
      `UPDATE gc_portal_users SET ${updates.join(", ")} WHERE id = ? AND org_id = ?`,
      params
    );

    const updated = await conn.execute(
      `SELECT id, org_id, email, first_name, last_name, role, email_domain,
              is_active, last_login_at, created_at, updated_at
       FROM gc_portal_users WHERE id = ?`,
      [userId]
    );

    return jsonResponse({ user: rowToPortalUser(updated.rows[0] as any) });
  }

  if (req.method === "DELETE") {
    // Soft-delete by deactivating
    await conn.execute("UPDATE gc_portal_users SET is_active = 0 WHERE id = ? AND org_id = ?", [
      userId,
      orgId,
    ]);
    return jsonResponse({ success: true });
  }

  return errorResponse("Method not allowed", 405);
}
