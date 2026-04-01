/**
 * GET  /api/portal/admin/announcements — list all announcements
 * POST /api/portal/admin/announcements — create announcement
 * Requires Clerk auth.
 */
import { getAuth } from "@clerk/nextjs/server";
import { NextApiRequest, NextApiResponse } from "next";
import { getPortalDbConnection } from "@/utils/portalDb";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { userId, orgId } = getAuth(req);
  if (!userId || !orgId) {
    return res.status(401).json({ error: "Unauthorised" });
  }

  const conn = getPortalDbConnection();

  if (req.method === "GET") {
    const result = await conn.execute(
      `SELECT id, org_id, title, body, type, is_active, published_at, expires_at, created_at
       FROM gc_portal_announcements
       WHERE org_id = ?
       ORDER BY published_at DESC`,
      [orgId]
    );

    return res.status(200).json({ announcements: result.rows });
  }

  if (req.method === "POST") {
    const { title, body, type = "notice", expiresAt } = req.body as {
      title?: string;
      body?: string;
      type?: string;
      expiresAt?: string;
    };

    if (!title || !body) {
      return res.status(400).json({ error: "title and body are required" });
    }

    const validTypes = ["notice", "alert", "info", "emergency"];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: "Invalid type" });
    }

    const insertRes = await conn.execute(
      `INSERT INTO gc_portal_announcements (org_id, title, body, type, expires_at)
       VALUES (?, ?, ?, ?, ?)`,
      [orgId, title, body, type, expiresAt || null]
    );

    return res.status(201).json({ success: true, id: (insertRes as any).insertId });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
