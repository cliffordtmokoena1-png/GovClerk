/**
 * GET /api/portal/admin/records-requests
 * List all FOIA / public records requests for the org.
 * Requires Clerk auth + admin role.
 */
import { getAuth } from "@clerk/nextjs/server";
import { NextApiRequest, NextApiResponse } from "next";
import { getPortalDbConnection } from "@/utils/portalDb";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { userId, orgId } = getAuth(req);
  if (!userId || !orgId) {
    return res.status(401).json({ error: "Unauthorised" });
  }

  const conn = getPortalDbConnection();

  const {
    status,
    startDate,
    endDate,
    page = "1",
    pageSize = "20",
  } = req.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page, 10));
  const pageSizeNum = Math.min(100, Math.max(1, parseInt(pageSize, 10)));
  const offset = (pageNum - 1) * pageSizeNum;

  let where = "org_id = ?";
  const params: any[] = [orgId];

  if (status) {
    where += " AND status = ?";
    params.push(status);
  }
  if (startDate) {
    where += " AND submitted_at >= ?";
    params.push(startDate);
  }
  if (endDate) {
    where += " AND submitted_at <= ?";
    params.push(endDate);
  }

  const countRes = await conn.execute(
    `SELECT COUNT(*) as cnt FROM gc_public_records_requests WHERE ${where}`,
    params
  );
  const total = parseInt((countRes.rows[0] as any).cnt, 10);

  const result = await conn.execute(
    `SELECT id, requester_name, requester_email, requester_phone, request_type,
            description, date_range_from, date_range_to, related_meeting_id,
            status, denial_reason, response_due_date, fulfilled_at, response_notes,
            tracking_number, submitted_at, updated_at
     FROM gc_public_records_requests
     WHERE ${where}
     ORDER BY submitted_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSizeNum, offset]
  );

  return res
    .status(200)
    .json({ requests: result.rows, total, page: pageNum, pageSize: pageSizeNum });
}
