/**
 * GET /api/public/portal/[slug]/records/track/[trackingNumber]
 * Look up a FOIA / public records request status by tracking number.
 * No auth required. Does NOT expose internal notes or requester contact details.
 */
import { NextRequest } from "next/server";
import { getPortalDbConnection } from "@/utils/portalDb";
import { errorResponse, jsonResponse } from "@/utils/apiHelpers";
import type { TrackRequestResponse } from "@/types/publicRecords";

export const config = {
  runtime: "edge",
};

export default async function handler(req: NextRequest): Promise<Response> {
  if (req.method !== "GET") {
    return errorResponse("Method not allowed", 405);
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/");
  const slugIndex = pathParts.indexOf("portal") + 1;
  const slug = pathParts[slugIndex];
  const trackingNumber = pathParts[pathParts.length - 1];

  if (!slug || !trackingNumber) {
    return errorResponse("Portal slug and tracking number are required", 400);
  }

  const conn = getPortalDbConnection();

  const settingsRes = await conn.execute(
    "SELECT org_id FROM gc_portal_settings WHERE slug = ? AND is_enabled = 1",
    [slug]
  );
  if (settingsRes.rows.length === 0) {
    return errorResponse("Portal not found", 404);
  }
  const orgId = (settingsRes.rows[0] as any).org_id as string;

  const result = await conn.execute(
    `SELECT tracking_number, status, submitted_at, response_due_date, denial_reason, fulfilled_at
     FROM gc_public_records_requests
     WHERE org_id = ? AND tracking_number = ?`,
    [orgId, trackingNumber]
  );

  if (result.rows.length === 0) {
    return errorResponse("Request not found", 404);
  }

  const row = result.rows[0] as any;
  const response: TrackRequestResponse = {
    trackingNumber: row.tracking_number,
    status: row.status,
    submittedAt: row.submitted_at,
    responseDueDate: row.response_due_date || null,
    denialReason: row.denial_reason || null,
    fulfilledAt: row.fulfilled_at || null,
  };

  return jsonResponse(response);
}
