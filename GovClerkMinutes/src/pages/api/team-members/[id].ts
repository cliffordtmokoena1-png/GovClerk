import withErrorReporting from "@/error/withErrorReporting";
import { getAuth } from "@clerk/nextjs/server";
import { connect } from "@planetscale/database";
import { NextRequest } from "next/server";
import { errorResponse, jsonResponse } from "@/utils/apiHelpers";
import { isUnknownColumnOrMissingTableError } from "@/utils/dbErrors";
import type { TeamMemberRole } from "./index";

export const config = {
  runtime: "edge",
};

export interface UpdateTeamMemberRequest {
  role?: TeamMemberRole;
  status?: "active" | "revoked";
}

function rowToTeamMember(row: Record<string, unknown>) {
  return {
    id: Number(row.id),
    ownerUserId: String(row.owner_user_id),
    memberEmail: String(row.member_email),
    memberUserId: row.member_user_id != null ? String(row.member_user_id) : null,
    role: String(row.role) as TeamMemberRole,
    status: String(row.status) as "pending" | "active" | "revoked",
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

async function handlePut(
  userId: string,
  id: number,
  body: UpdateTeamMemberRequest
): Promise<Response> {
  const { role, status } = body;

  if (role !== undefined && role !== "admin" && role !== "member") {
    return errorResponse("Role must be 'admin' or 'member'", 400);
  }
  if (status !== undefined && status !== "active" && status !== "revoked") {
    return errorResponse("Status must be 'active' or 'revoked'", 400);
  }
  if (role === undefined && status === undefined) {
    return errorResponse("At least one of 'role' or 'status' must be provided", 400);
  }

  const conn = getConnection();

  try {
    const existing = await conn.execute(
      "SELECT id FROM gc_team_members WHERE id = ? AND owner_user_id = ?",
      [id, userId]
    );

    if (existing.rows.length === 0) {
      return errorResponse("Team member not found", 404);
    }

    const setClauses: string[] = ["updated_at = NOW()"];
    const values: unknown[] = [];

    if (role !== undefined) {
      setClauses.push("role = ?");
      values.push(role);
    }
    if (status !== undefined) {
      setClauses.push("status = ?");
      values.push(status);
    }

    values.push(id, userId);

    await conn.execute(
      `UPDATE gc_team_members SET ${setClauses.join(", ")} WHERE id = ? AND owner_user_id = ?`,
      values
    );

    const updated = await conn.execute("SELECT * FROM gc_team_members WHERE id = ?", [id]);
    return jsonResponse({ member: rowToTeamMember(updated.rows[0] as Record<string, unknown>) });
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

async function handleDelete(userId: string, id: number): Promise<Response> {
  const conn = getConnection();

  try {
    const existing = await conn.execute(
      "SELECT id FROM gc_team_members WHERE id = ? AND owner_user_id = ?",
      [id, userId]
    );

    if (existing.rows.length === 0) {
      return errorResponse("Team member not found", 404);
    }

    await conn.execute(
      "UPDATE gc_team_members SET status = 'revoked', updated_at = NOW() WHERE id = ? AND owner_user_id = ?",
      [id, userId]
    );

    return jsonResponse({ success: true });
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

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/");
  const idStr = pathParts[pathParts.length - 1];
  const id = parseInt(idStr, 10);

  if (isNaN(id) || id <= 0) {
    return errorResponse("Invalid team member ID", 400);
  }

  if (req.method === "PUT") {
    const body = await req.json().catch(() => ({}));
    return handlePut(userId, id, body as UpdateTeamMemberRequest);
  }

  if (req.method === "DELETE") {
    return handleDelete(userId, id);
  }

  return errorResponse("Method not allowed", 405);
}

export default withErrorReporting(handler);
