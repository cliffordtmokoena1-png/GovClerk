/**
 * Admin portal user management endpoints (Clerk-authed).
 *
 * GET  /api/portal/auth/users — List all portal users for the org
 * POST /api/portal/auth/users — Create a portal user (admin only)
 */

import { NextRequest } from "next/server";
import { getAuth } from "@clerk/nextjs/server";
import { getPortalDbConnection } from "@/utils/portalDb";
import { errorResponse, jsonResponse } from "@/utils/apiHelpers";
import { hashPassword, isEmailDomainAllowed } from "@/portal-auth/portalAuth";
import { resolveRequestContext } from "@/utils/resolveRequestContext";
import type { PortalUser, CreatePortalUserRequest } from "@/types/portal";

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

  const { orgId } = await resolveRequestContext(auth.userId, null, req.headers);
  if (!orgId) {
    return errorResponse("Organization context required", 400);
  }

  const conn = getPortalDbConnection();

  if (req.method === "GET") {
    const result = await conn.execute(
      `SELECT id, org_id, email, first_name, last_name, role, email_domain,
              is_active, last_login_at, created_at, updated_at
       FROM gc_portal_users
       WHERE org_id = ?
       ORDER BY created_at DESC`,
      [orgId]
    );

    const users: PortalUser[] = (result.rows as any[]).map(rowToPortalUser);
    return jsonResponse({ users });
  }

  if (req.method === "POST") {
    // Check that the requesting user has admin role in portal
    const sessionClaims = auth.sessionClaims as any;
    if (sessionClaims?.metadata?.role !== "admin") {
      return errorResponse("Admin role required", 403);
    }

    let body: CreatePortalUserRequest;
    try {
      body = await req.json();
    } catch {
      return errorResponse("Invalid request body", 400);
    }

    const { email, password, firstName, lastName, role = "member" } = body;
    if (!email || !password) {
      return errorResponse("email and password are required", 400);
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Validate domain
    const domainAllowed = await isEmailDomainAllowed(orgId, normalizedEmail);
    if (!domainAllowed) {
      return errorResponse("Email domain not authorised for this portal", 403);
    }

    // Check for duplicates
    const existing = await conn.execute(
      "SELECT id FROM gc_portal_users WHERE org_id = ? AND email = ?",
      [orgId, normalizedEmail]
    );
    if (existing.rows.length > 0) {
      return errorResponse("A user with this email already exists", 409);
    }

    const passwordHash = await hashPassword(password);
    const domain = normalizedEmail.split("@")[1] ?? "";

    const insertResult = await conn.execute(
      `INSERT INTO gc_portal_users
         (org_id, email, password_hash, first_name, last_name, role, email_domain, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [orgId, normalizedEmail, passwordHash, firstName ?? null, lastName ?? null, role, domain]
    );

    const newUser = await conn.execute(
      `SELECT id, org_id, email, first_name, last_name, role, email_domain,
              is_active, last_login_at, created_at, updated_at
       FROM gc_portal_users WHERE id = ?`,
      [(insertResult as any).insertId]
    );

    return jsonResponse({ user: rowToPortalUser(newUser.rows[0] as any) }, 201);
  }

  return errorResponse("Method not allowed", 405);
}
