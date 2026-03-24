import { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import { dbQuery } from "@/backend/db";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { userId } = getAuth(req);
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const tokenDetails = await dbQuery(
      `
      SELECT p.id, p.credit, p.action, p.checkout_session_id, p.transcript_id, p.invoice_id, p.created_at, p.mode,
             t.title as transcript_title
      FROM payments p
      LEFT JOIN transcripts t ON p.transcript_id = t.id
      WHERE p.user_id = ?
      ORDER BY p.created_at DESC
      LIMIT 50
    `,
      [userId]
    );

    return res.status(200).json(tokenDetails);
  } catch (error) {
    console.error("Error fetching token details:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}
