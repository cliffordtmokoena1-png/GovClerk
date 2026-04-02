/**
 * PUT    /api/portal/admin/announcements/[id] — update announcement
 * DELETE /api/portal/admin/announcements/[id] — deactivate announcement
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

  const { id } = req.query as { id: string };
  if (!id) {
    return res.status(400).json({ error: "Announcement ID is required" });
  }

  const conn = getPortalDbConnection();

  const checkRes = await conn.execute(
    "SELECT id FROM gc_portal_announcements WHERE id = ? AND org_id = ?",
    [id, orgId]
  );
  if (checkRes.rows.length === 0) {
    return res.status(404).json({ error: "Announcement not found" });
  }

  if (req.method === "PUT") {
    const { title, body, type, isActive, expiresAt } = req.body as {
      title?: string;
      body?: string;
      type?: string;
      isActive?: boolean;
      expiresAt?: string | null;
    };

    const setClauses: string[] = [];
    const params: any[] = [];

    if (title !== undefined) {
      setClauses.push("title = ?");
      params.push(title);
    }
    if (body !== undefined) {
      setClauses.push("body = ?");
      params.push(body);
    }
    if (type !== undefined) {
      setClauses.push("type = ?");
      params.push(type);
    }
    if (isActive !== undefined) {
      setClauses.push("is_active = ?");
      params.push(isActive ? 1 : 0);
    }
    if (expiresAt !== undefined) {
      setClauses.push("expires_at = ?");
      params.push(expiresAt || null);
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    params.push(id, orgId);
    await conn.execute(
      `UPDATE gc_portal_announcements SET ${setClauses.join(", ")} WHERE id = ? AND org_id = ?`,
      params
    );

    return res.status(200).json({ success: true });
  }

  if (req.method === "DELETE") {
    await conn.execute(
      "UPDATE gc_portal_announcements SET is_active = 0 WHERE id = ? AND org_id = ?",
      [id, orgId]
    );
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
