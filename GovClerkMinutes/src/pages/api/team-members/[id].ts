import { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import { connect } from "@planetscale/database";
import withErrorReporting from "@/error/withErrorReporting";
import { isUnknownColumnOrMissingTableError } from "@/utils/dbErrors";
import type { TeamMember, TeamMemberRole } from "./index";

export interface UpdateTeamMemberRequest {
  role?: TeamMemberRole;
  status?: "active" | "revoked";
}

function getConnection() {
  return connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { userId } = getAuth(req);
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const id = parseInt(req.query.id as string, 10);
  if (isNaN(id) || id <= 0) {
    return res.status(400).json({ error: "Invalid team member ID" });
  }

  const conn = getConnection();

  if (req.method === "PUT") {
    const body: UpdateTeamMemberRequest = req.body || {};
    const { role, status } = body;

    if (role !== undefined && role !== "admin" && role !== "member") {
      return res.status(400).json({ error: "Role must be 'admin' or 'member'" });
    }
    if (status !== undefined && status !== "active" && status !== "revoked") {
      return res.status(400).json({ error: "Status must be 'active' or 'revoked'" });
    }
    if (role === undefined && status === undefined) {
      return res.status(400).json({ error: "At least one of 'role' or 'status' must be provided" });
    }

    try {
      const existing = await conn.execute(
        "SELECT id FROM gc_team_members WHERE id = ? AND owner_user_id = ?",
        [id, userId]
      );

      if (existing.rows.length === 0) {
        return res.status(404).json({ error: "Team member not found" });
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

      const updated = await conn.execute<TeamMember>(
        "SELECT id, member_email, member_user_id, role, status, invited_at, accepted_at FROM gc_team_members WHERE id = ?",
        [id]
      );
      return res.status(200).json({ member: updated.rows[0] });
    } catch (err) {
      if (isUnknownColumnOrMissingTableError(err)) {
        return res.status(503).json({
          error: "Team members table is not yet available. Please run database migrations."
        });
      }
      throw err;
    }
  }

  if (req.method === "DELETE") {
    try {
      const existing = await conn.execute(
        "SELECT id FROM gc_team_members WHERE id = ? AND owner_user_id = ?",
        [id, userId]
      );

      if (existing.rows.length === 0) {
        return res.status(404).json({ error: "Team member not found" });
      }

      await conn.execute(
        "UPDATE gc_team_members SET status = 'revoked', updated_at = NOW() WHERE id = ? AND owner_user_id = ?",
        [id, userId]
      );

      return res.status(200).json({ success: true });
    } catch (err) {
      if (isUnknownColumnOrMissingTableError(err)) {
        return res.status(503).json({
          error: "Team members table is not yet available. Please run database migrations."
        });
      }
      throw err;
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}

export default withErrorReporting(handler);