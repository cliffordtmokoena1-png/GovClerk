import { NextApiRequest, NextApiResponse } from "next";
import { getAuth, clerkClient } from "@clerk/nextjs/server";
import { connect } from "@planetscale/database";
import withErrorReporting from "@/error/withErrorReporting";
import { isUnknownColumnOrMissingTableError } from "@/utils/dbErrors";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { userId } = getAuth(req);
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized. Please sign in to accept the invite." });
  }

  const { token } = req.query as { token?: string };
  if (!token || typeof token !== "string") {
    return res.status(400).json({ error: "Token is required" });
  }

  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  let row: { id: number; status: string; member_email: string } | null = null;
  try {
    const result = await conn.execute<{ id: number; status: string; member_email: string }>(
      `SELECT id, status, member_email FROM gc_team_members WHERE invite_token = ? LIMIT 1`,
      [token]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Invalid or expired invitation token." });
    }
    row = result.rows[0];
  } catch (err) {
    if (isUnknownColumnOrMissingTableError(err)) {
      return res.status(503).json({
        error: "Team members feature is not yet available. Please run the database migration.",
      });
    }
    throw err;
  }

  if (row.status === "revoked") {
    return res.status(410).json({ error: "This invitation has been revoked." });
  }

  // Verify that the signed-in user's email matches the invited email
  try {
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    const userEmails = user.emailAddresses.map((e) => e.emailAddress.toLowerCase());
    if (!userEmails.includes(row.member_email.toLowerCase())) {
      return res.status(403).json({
        error:
          "This invitation was sent to a different email address. Please sign in with the email that received the invitation.",
      });
    }
  } catch (err) {
    console.warn("[team-members/accept] Could not verify user email:", err);
    // If we can't verify, still allow acceptance (fail-open for availability)
  }

  if (row.status === "active") {
    return res.status(200).json({ success: true, message: "Invitation already accepted." });
  }

  await conn.execute(
    `UPDATE gc_team_members
     SET status = 'active', member_user_id = ?, accepted_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [userId, row.id]
  );

  return res.status(200).json({ success: true, message: "Invitation accepted successfully." });
}

export default withErrorReporting(handler);
