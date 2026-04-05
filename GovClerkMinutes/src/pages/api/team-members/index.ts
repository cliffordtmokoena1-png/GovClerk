import { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import { connect } from "@planetscale/database";
import withErrorReporting from "@/error/withErrorReporting";
import { getCustomerDetails } from "@/pages/api/get-customer-details";
import { getMaxMembers } from "@/utils/teamMembers";
import { getPrettyPlanName } from "@/utils/price";
import { isUnknownColumnOrMissingTableError } from "@/utils/dbErrors";

export type TeamMemberRole = "admin" | "member";
export type TeamMemberStatus = "pending" | "active" | "revoked";

export type TeamMember = {
  id: number;
  member_email: string;
  member_user_id: string | null;
  role: TeamMemberRole;
  status: TeamMemberStatus;
  invited_at: string;
  accepted_at: string | null;
};

export type ApiGetTeamMembersResponse = {
  members: TeamMember[];
  maxMembers: number;
  planName: string;
};

export type AddTeamMemberRequest = {
  email: string;
  role?: TeamMemberRole;
};

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

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { userId } = getAuth(req);
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const conn = getConnection();

  if (req.method === "GET") {
    let members: TeamMember[] = [];
    try {
      const result = await conn.execute<TeamMember>(
        `SELECT id, member_email, member_user_id, role, status, invited_at, accepted_at
         FROM gc_team_members
         WHERE owner_user_id = ?
         ORDER BY invited_at DESC`,
        [userId]
      );
      members = result.rows;
    } catch (err) {
      if (isUnknownColumnOrMissingTableError(err)) {
        console.warn("[team-members] gc_team_members table not found (schema migration pending).");
        members = [];
      } else {
        throw err;
      }
    }

    const customerDetails = await getCustomerDetails(userId);
    const plan = customerDetails.planName ?? "Free";
    const maxMembers = getMaxMembers(plan);
    const planName = getPrettyPlanName(plan) || "Free";

    return res.status(200).json({ members, maxMembers, planName } as ApiGetTeamMembersResponse);
  }

  if (req.method === "POST") {
    const body: AddTeamMemberRequest = req.body || {};
    const { email, role = "member" } = body;

    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "Email is required" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Invalid email address" });
    }

    if (role !== "admin" && role !== "member") {
      return res.status(400).json({ error: "Role must be 'admin' or 'member'" });
    }

    // Check plan limits before adding
    const customerDetails = await getCustomerDetails(userId);
    const plan = customerDetails.planName ?? "Free";
    const maxMembers = getMaxMembers(plan);

    try {
      const currentResult = await conn.execute(
        "SELECT COUNT(*) as count FROM gc_team_members WHERE owner_user_id = ? AND status != 'revoked'",
        [userId]
      );
      const currentCount = Number((currentResult.rows[0] as Record<string, unknown>).count);

      // maxMembers includes the owner, so active members must be < maxMembers - 1
      if (currentCount >= maxMembers - 1) {
        return res.status(403).json({
          error: `Your ${getPrettyPlanName(plan) || "Free"} plan allows up to ${maxMembers} members (including you). Please upgrade to add more.`,
        });
      }

      // Check for duplicate
      const existing = await conn.execute(
        "SELECT id, status FROM gc_team_members WHERE owner_user_id = ? AND member_email = ?",
        [userId, email.toLowerCase()]
      );

      if (existing.rows.length > 0) {
        const row = existing.rows[0] as Record<string, unknown>;
        if (String(row.status) !== "revoked") {
          return res.status(409).json({ error: "A team member with this email already exists" });
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

        const updated = await conn.execute(
          "SELECT id, member_email, member_user_id, role, status, invited_at, accepted_at FROM gc_team_members WHERE id = ?",
          [Number(row.id)]
        );
        return res.status(200).json({ member: updated.rows[0] });
      }

      const token = generateInviteToken();
      const insert = await conn.execute(
        `INSERT INTO gc_team_members (owner_user_id, member_email, role, status, invite_token)
         VALUES (?, ?, ?, 'pending', ?)`,
        [userId, email.toLowerCase(), role, token]
      );

      const newId = Number((insert as unknown as { insertId: string | number }).insertId);
      const newRow = await conn.execute(
        "SELECT id, member_email, member_user_id, role, status, invited_at, accepted_at FROM gc_team_members WHERE id = ?",
        [newId]
      );
      return res.status(201).json({ member: newRow.rows[0] });
    } catch (err) {
      if (isUnknownColumnOrMissingTableError(err)) {
        return res.status(503).json({
          error: "Team members table is not yet available. Please run database migrations.",
        });
      }
      throw err;
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}

export default withErrorReporting(handler);