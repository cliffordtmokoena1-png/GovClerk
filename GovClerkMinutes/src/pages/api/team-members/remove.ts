import { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import { connect } from "@planetscale/database";
import withErrorReporting from "@/error/withErrorReporting";
import { isUnknownColumnOrMissingTableError } from "@/utils/dbErrors";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { userId } = getAuth(req);
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { memberId, email } = req.body as { memberId?: number; email?: string };
  if (!memberId && !email) {
    return res.status(400).json({ error: "memberId or email is required" });
  }

  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  try {
    if (memberId) {
      await conn.execute(
        `UPDATE gc_team_members SET status = 'revoked'
         WHERE id = ? AND owner_user_id = ?`,
        [memberId, userId]
      );
    } else {
      await conn.execute(
        `UPDATE gc_team_members SET status = 'revoked'
         WHERE member_email = ? AND owner_user_id = ?`,
        [email!.trim().toLowerCase(), userId]
      );
    }
  } catch (err) {
    if (isUnknownColumnOrMissingTableError(err)) {
      return res.status(503).json({
        error: "Team members feature is not yet available. Please run the database migration.",
      });
    }
    throw err;
  }

  return res.status(200).json({ success: true });
}

export default withErrorReporting(handler);
