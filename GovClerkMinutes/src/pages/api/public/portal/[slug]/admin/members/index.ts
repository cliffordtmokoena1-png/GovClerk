/**
 * Portal-session-authenticated member management endpoints.
 *
 * GET  /api/public/portal/[slug]/admin/members — List all portal members for the org
 * POST /api/public/portal/[slug]/admin/members — Create a portal member (seat-limited)
 *
 * Only portal users with role='admin' may access these endpoints.
 */

import { NextRequest } from "next/server";
import { getPortalDbConnection } from "@/utils/portalDb";
import { getPortalSession, hashPassword } from "@/portal-auth/portalAuth";
import { isOrganizationalEmail } from "@/utils/freeEmailProviders";
import { jsonResponse, errorResponse } from "@/utils/apiHelpers";
import { PORTAL_PAYSTACK_PLANS } from "@/utils/portalPaystack";
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

  // Extract slug from URL path: /api/public/portal/[slug]/admin/members
  const url = new URL(req.url);
  const pathParts = url.pathname.split("/");
  const portalIndex = pathParts.indexOf("portal");
  const slug = portalIndex >= 0 ? pathParts[portalIndex + 1] : null;

  if (!slug) {
    return errorResponse("Portal slug is required", 400);
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
  const userResult = await conn.execute(
    "SELECT role FROM gc_portal_users WHERE id = ? AND org_id = ?",
    [session.portalUserId, orgId]
  );
  if (userResult.rows.length === 0) {
    return errorResponse("User not found", 404);
  }
  const userRole = (userResult.rows[0] as any).role;
  if (userRole !== "admin") {
    return errorResponse("Admin role required", 403);
  }

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
    let body: {
      email: string;
      password: string;
      firstName?: string;
      lastName?: string;
      role?: string;
    };
    try {
      body = await req.json();
    } catch {
      return errorResponse("Invalid request body", 400);
    }

    const { email, password, firstName, lastName, role = "member" } = body;
    if (!email || !password) {
      return errorResponse("email and password are required", 400);
    }
    if (password.length < 8) {
      return errorResponse("Password must be at least 8 characters", 400);
    }
    if (!["admin", "member", "readonly"].includes(role)) {
      return errorResponse("Invalid role. Must be admin, member, or readonly", 400);
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Validate organisational email
    if (!isOrganizationalEmail(normalizedEmail)) {
      return errorResponse(
        "Please use an organisational email address. Free email providers are not allowed.",
        400
      );
    }

    // Check for duplicates
    const existing = await conn.execute(
      "SELECT id FROM gc_portal_users WHERE org_id = ? AND email = ?",
      [orgId, normalizedEmail]
    );
    if (existing.rows.length > 0) {
      return errorResponse("A user with this email already exists", 409);
    }

    // Enforce seat limits from gc_portal_subscriptions.
    // Use an atomic conditional UPDATE to avoid race conditions:
    // only increment seats_used if still below seats_included.
    const subResult = await conn.execute(
      "SELECT seats_included, seats_used FROM gc_portal_subscriptions WHERE org_id = ?",
      [orgId]
    );

    let seatsIncluded: number = PORTAL_PAYSTACK_PLANS.starter.seats;

    if (subResult.rows.length > 0) {
      const sub = subResult.rows[0] as any;
      seatsIncluded = Number(sub.seats_included);
      const seatsUsed = Number(sub.seats_used);

      if (seatsUsed >= seatsIncluded) {
        return errorResponse(
          `You've reached your plan's seat limit (${seatsIncluded} seats). Please upgrade your plan to add more members.`,
          403
        );
      }
    } else {
      // No subscription row — count active users to check against Starter default
      const countResult = await conn.execute(
        "SELECT COUNT(*) as cnt FROM gc_portal_users WHERE org_id = ? AND is_active = 1",
        [orgId]
      );
      const seatsUsed = Number((countResult.rows[0] as any).cnt);
      if (seatsUsed >= seatsIncluded) {
        return errorResponse(
          `You've reached your plan's seat limit (${seatsIncluded} seats). Please upgrade your plan to add more members.`,
          403
        );
      }
    }

    // Create the user
    const passwordHash = await hashPassword(password);
    const domain = normalizedEmail.split("@")[1] ?? "";

    const insertResult = await conn.execute(
      `INSERT INTO gc_portal_users
         (org_id, email, password_hash, first_name, last_name, role, email_domain, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [orgId, normalizedEmail, passwordHash, firstName ?? null, lastName ?? null, role, domain]
    );

    // Atomically increment seats_used, but only if still below the limit (guards against race conditions)
    await conn.execute(
      `UPDATE gc_portal_subscriptions
       SET seats_used = seats_used + 1
       WHERE org_id = ? AND seats_used < seats_included`,
      [orgId]
    );

    const newUserResult = await conn.execute(
      `SELECT id, org_id, email, first_name, last_name, role, email_domain,
              is_active, last_login_at, created_at, updated_at
       FROM gc_portal_users WHERE id = ?`,
      [(insertResult as any).insertId]
    );

    return jsonResponse({ user: rowToPortalUser(newUserResult.rows[0] as any) }, 201);
  }

  return errorResponse("Method not allowed", 405);
}
