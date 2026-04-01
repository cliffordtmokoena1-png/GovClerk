/**
 * Admin shared password management endpoints (Clerk-authed).
 *
 * GET    /api/portal/auth/shared-password — List shared passwords for org
 * POST   /api/portal/auth/shared-password — Create a new shared password
 * DELETE /api/portal/auth/shared-password?id=<id> — Deactivate a shared password
 */

import { NextRequest } from "next/server";
import { getAuth } from "@clerk/nextjs/server";
import { getPortalDbConnection } from "@/utils/portalDb";
import { errorResponse, jsonResponse } from "@/utils/apiHelpers";
import { hashPassword } from "@/portal-auth/portalAuth";
import { resolveRequestContext } from "@/utils/resolveRequestContext";
import type { PortalSharedPassword, CreateSharedPasswordRequest } from "@/types/portal";

export const config = {
  runtime: "edge",
};

function rowToSharedPassword(row: any): PortalSharedPassword {
  return {
    id: row.id,
    orgId: row.org_id,
    label: row.label,
    expiresAt: row.expires_at ?? null,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
  };
}

export default async function handler(req: NextRequest): Promise<Response> {
  const auth = getAuth(req);
  if (!auth.userId) {
    return errorResponse("Unauthorized", 401);
  }

  // Only admins can manage shared passwords
  const sessionClaims = auth.sessionClaims as any;
  if (sessionClaims?.metadata?.role !== "admin") {
    return errorResponse("Admin role required", 403);
  }

  const { orgId } = await resolveRequestContext(auth.userId, null, req.headers);
  if (!orgId) {
    return errorResponse("Organization context required", 400);
  }

  const conn = getPortalDbConnection();

  if (req.method === "GET") {
    const result = await conn.execute(
      `SELECT id, org_id, label, expires_at, is_active, created_at
       FROM gc_portal_shared_passwords
       WHERE org_id = ?
       ORDER BY created_at DESC`,
      [orgId]
    );

    const passwords: PortalSharedPassword[] = (result.rows as any[]).map(rowToSharedPassword);
    return jsonResponse({ sharedPasswords: passwords });
  }

  if (req.method === "POST") {
    let body: CreateSharedPasswordRequest;
    try {
      body = await req.json();
    } catch {
      return errorResponse("Invalid request body", 400);
    }

    const { label, password, expiresAt } = body;
    if (!label || !password) {
      return errorResponse("label and password are required", 400);
    }

    if (password.length < 8) {
      return errorResponse("Password must be at least 8 characters", 400);
    }

    const passwordHash = await hashPassword(password);

    const insertResult = await conn.execute(
      `INSERT INTO gc_portal_shared_passwords
         (org_id, password_hash, label, expires_at, is_active, created_by_user_id)
       VALUES (?, ?, ?, ?, 1, NULL)`,
      [orgId, passwordHash, label, expiresAt ?? null]
    );

    const newRow = await conn.execute(
      `SELECT id, org_id, label, expires_at, is_active, created_at
       FROM gc_portal_shared_passwords WHERE id = ?`,
      [(insertResult as any).insertId]
    );

    return jsonResponse({ sharedPassword: rowToSharedPassword(newRow.rows[0] as any) }, 201);
  }

  if (req.method === "DELETE") {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id || isNaN(Number(id))) {
      return errorResponse("Valid id query parameter is required", 400);
    }

    // Verify it belongs to this org
    const check = await conn.execute(
      "SELECT id FROM gc_portal_shared_passwords WHERE id = ? AND org_id = ?",
      [id, orgId]
    );
    if (check.rows.length === 0) {
      return errorResponse("Shared password not found", 404);
    }

    await conn.execute(
      "UPDATE gc_portal_shared_passwords SET is_active = 0 WHERE id = ? AND org_id = ?",
      [id, orgId]
    );

    return jsonResponse({ success: true });
  }

  return errorResponse("Method not allowed", 405);
}
