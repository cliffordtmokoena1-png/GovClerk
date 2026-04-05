import withErrorReporting from "@/error/withErrorReporting";
import { getAuth } from "@clerk/nextjs/server";
import { connect } from "@planetscale/database";
import { NextRequest } from "next/server";
import { errorResponse, jsonResponse } from "@/utils/apiHelpers";
import { isUnknownColumnOrMissingTableError } from "@/utils/dbErrors";

export const config = {
  runtime: "edge",
};

export type TeamMemberRole = "admin" | "member";
export type TeamMemberStatus = "pending" | "active" | "revoked";

export interface TeamMember {
  id: number;
  ownerUserId: string;
  memberEmail: string;
  memberUserId: string | null;
  role: TeamMemberRole;
  status: TeamMemberStatus;
  inviteToken: string | null;
  invitedAt: string;
  acceptedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TeamMembersListResponse {
  members: TeamMember[];
}

export interface AddTeamMemberRequest {
  email: string;
  role?: TeamMemberRole;
}

function rowToTeamMember(row: Record<string, unknown>): TeamMember {
  return {
    id: Number(row.id),
    ownerUserId: String(row.owner_user_id),
    memberEmail: String(row.member_email),
    memberUserId: row.member_user_id != null ? String(row.member_user_id) : null,
    role: String(row.role) as TeamMemberRole,
    status: String(row.status) as TeamMemberStatus,
    inviteToken: row.invite_token != null ? String(row.invite_token) : null,
    invitedAt: String(row.invited_at),
    acceptedAt: row.accepted_at != null ? String(row.accepted_at) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function getConnection() {
  return connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });
}

function generateInviteToken(): string {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function handleGet(userId: string): Promise<Response> {
  const conn = getConnection();

  try {
    const result = await conn.execute(
      `SELECT id, owner_user_id, member_email, member_user_id, role, status,
              invite_token, invited_at, accepted_at, created_at, updated_at
       FROM gc_team_members
       WHERE owner_user_id = ?
       ORDER BY created_at DESC`,
      [userId]
    );

    const members = (result.rows as Record<string, unknown>[]).map(rowToTeamMember);
    const response: TeamMembersListResponse = { members };
    return jsonResponse(response);
  } catch (err) {
    if (isUnknownColumnOrMissingTableError(err)) {
      return jsonResponse<TeamMembersListResponse>({ members: [] });
    }
    throw err;
  }
}

async function handlePost(userId: string, body: AddTeamMemberRequest): Promise<Response> {
  const { email, role = "member" } = body;

  if (!email || typeof email !== "string") {
    return errorResponse("Email is required", 400);
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return errorResponse("Invalid email address", 400);
  }

  if (role !== "admin" && role !== "member") {
    return errorResponse("Role must be 'admin' or 'member'", 400);
  }

  const conn = getConnection();

  try {
    // Check for duplicate
    const existing = await conn.execute(
      "SELECT id, status FROM gc_team_members WHERE owner_user_id = ? AND member_email = ?",
      [userId, email.toLowerCase()]
    );

    if (existing.rows.length > 0) {
      const row = existing.rows[0] as Record<string, unknown>;
      if (String(row.status) !== "revoked") {
        return errorResponse("A team member with this email already exists", 409);
      }
      // Re-invite a previously revoked member
      const token = generateInviteToken();
      await conn.execute(
        `UPDATE gc_team_members
         SET role = ?, status = 'pending', invite_token = ?, invited_at = NOW(),
             accepted_at = NULL, member_user_id = NULL, updated_at = NOW()
         WHERE id = ?`,
        [role, token, Number(row.id)]
      );

      const updated = await conn.execute("SELECT * FROM gc_team_members WHERE id = ?", [
        Number(row.id),
      ]);
      return jsonResponse({ member: rowToTeamMember(updated.rows[0] as Record<string, unknown>) }, 200);
    }

    const token = generateInviteToken();
    const insert = await conn.execute(
      `INSERT INTO gc_team_members (owner_user_id, member_email, role, status, invite_token)
       VALUES (?, ?, ?, 'pending', ?)`,
      [userId, email.toLowerCase(), role, token]
    );

    const newId = Number((insert as unknown as { insertId: string | number }).insertId);
    const row = await conn.execute("SELECT * FROM gc_team_members WHERE id = ?", [newId]);
    return jsonResponse({ member: rowToTeamMember(row.rows[0] as Record<string, unknown>) }, 201);
  } catch (err) {
    if (isUnknownColumnOrMissingTableError(err)) {
      return errorResponse(
        "Team members table is not yet available. Please run database migrations.",
        503
      );
    }
    throw err;
  }
}

async function handler(req: NextRequest): Promise<Response> {
  const { userId } = getAuth(req);
  if (!userId) {
    return errorResponse("Unauthorized", 401);
  }

  if (req.method === "GET") {
    return handleGet(userId);
  }

  if (req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    return handlePost(userId, body as AddTeamMemberRequest);
  }

  return errorResponse("Method not allowed", 405);
}

export default withErrorReporting(handler);
