import { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import { connect } from "@planetscale/database";
import withErrorReporting from "@/error/withErrorReporting";
import { getCustomerDetails } from "@/pages/api/get-customer-details";
import { getMaxMembers } from "@/utils/teamMembers";
import { getPrettyPlanName } from "@/utils/price";
import { isUnknownColumnOrMissingTableError } from "@/utils/dbErrors";

export type TeamMember = {
  id: number;
  member_email: string;
  member_user_id: string | null;
  role: "admin" | "member";
  status: "pending" | "active" | "revoked";
  invited_at: string;
  accepted_at: string | null;
};

export type ApiGetTeamMembersResponse = {
  members: TeamMember[];
  maxMembers: number;
  planName: string;
};

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { userId } = getAuth(req);
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

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

export default withErrorReporting(handler);
