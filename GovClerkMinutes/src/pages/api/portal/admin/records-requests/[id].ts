/**
 * PUT /api/portal/admin/records-requests/[id]
 * Update a FOIA / public records request status, notes, or denial reason.
 * Requires Clerk auth + admin role.
 */
import { getAuth } from "@clerk/nextjs/server";
import { NextApiRequest, NextApiResponse } from "next";
import { getPortalDbConnection } from "@/utils/portalDb";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PUT") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { userId, orgId } = getAuth(req);
  if (!userId || !orgId) {
    return res.status(401).json({ error: "Unauthorised" });
  }

  const { id } = req.query as { id: string };
  if (!id) {
    return res.status(400).json({ error: "Request ID is required" });
  }

  const { status, responseNotes, denialReason, fulfilledAt } = req.body as {
    status?: string;
    responseNotes?: string;
    denialReason?: string;
    fulfilledAt?: string;
  };

  const conn = getPortalDbConnection();

  // Verify the request belongs to this org
  const checkRes = await conn.execute(
    "SELECT id FROM gc_public_records_requests WHERE id = ? AND org_id = ?",
    [id, orgId]
  );
  if (checkRes.rows.length === 0) {
    return res.status(404).json({ error: "Request not found" });
  }

  const setClauses: string[] = [];
  const params: any[] = [];

  if (status) {
    const validStatuses = [
      "received", "acknowledged", "in_review", "fulfilled",
      "partially_fulfilled", "denied", "withdrawn",
    ];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    setClauses.push("status = ?");
    params.push(status);
  }
  if (responseNotes !== undefined) {
    setClauses.push("response_notes = ?");
    params.push(responseNotes);
  }
  if (denialReason !== undefined) {
    setClauses.push("denial_reason = ?");
    params.push(denialReason);
  }
  if (fulfilledAt !== undefined) {
    setClauses.push("fulfilled_at = ?");
    params.push(fulfilledAt || null);
  }

  if (setClauses.length === 0) {
    return res.status(400).json({ error: "No fields to update" });
  }

  params.push(id, orgId);
  await conn.execute(
    `UPDATE gc_public_records_requests SET ${setClauses.join(", ")} WHERE id = ? AND org_id = ?`,
    params
  );

  return res.status(200).json({ success: true });
}
