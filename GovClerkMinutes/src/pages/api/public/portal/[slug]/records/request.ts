/**
 * POST /api/public/portal/[slug]/records/request
 * Submit a FOIA / public records request.
 * No auth required — any citizen can submit.
 */
import { NextRequest } from "next/server";
import { getPortalDbConnection } from "@/utils/portalDb";
import { errorResponse, jsonResponse } from "@/utils/apiHelpers";
import type { SubmitRecordsRequestBody, SubmitRecordsRequestResponse } from "@/types/publicRecords";

export const config = {
  runtime: "edge",
};

// Add business days (skips weekends) to a date
function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const day = result.getDay();
    if (day !== 0 && day !== 6) {
      added++;
    }
  }
  return result;
}

function formatDateOnly(date: Date): string {
  return date.toISOString().split("T")[0];
}

// Generate a tracking number: GC-{YYYY}-{random 6-digit}
function generateTrackingNumber(): string {
  const year = new Date().getFullYear();
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `GC-${year}-${rand}`;
}

export default async function handler(req: NextRequest): Promise<Response> {
  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/");
  const slugIndex = pathParts.indexOf("portal") + 1;
  const slug = pathParts[slugIndex];

  if (!slug) {
    return errorResponse("Portal slug is required", 400);
  }

  let body: SubmitRecordsRequestBody;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid request body", 400);
  }

  const {
    requesterName,
    requesterEmail,
    requesterPhone,
    requestType,
    description,
    dateRangeFrom,
    dateRangeTo,
    relatedMeetingId,
  } = body;

  if (!requesterName || !requesterEmail || !requestType || !description) {
    return errorResponse(
      "requesterName, requesterEmail, requestType, and description are required",
      400
    );
  }

  const validTypes = ["foia", "open_records", "inspection", "certification"];
  if (!validTypes.includes(requestType)) {
    return errorResponse("Invalid requestType", 400);
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

  const trackingNumber = generateTrackingNumber();
  const responseDueDate = formatDateOnly(addBusinessDays(new Date(), 15));

  await conn.execute(
    `INSERT INTO gc_public_records_requests
     (org_id, requester_name, requester_email, requester_phone, request_type, description,
      date_range_from, date_range_to, related_meeting_id, status, response_due_date, tracking_number)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'received', ?, ?)`,
    [
      orgId,
      requesterName,
      requesterEmail,
      requesterPhone || null,
      requestType,
      description,
      dateRangeFrom || null,
      dateRangeTo || null,
      relatedMeetingId || null,
      responseDueDate,
      trackingNumber,
    ]
  );

  const response: SubmitRecordsRequestResponse = {
    success: true,
    trackingNumber,
    message: `Your request has been received. We will respond by ${responseDueDate}. Please save your tracking number: ${trackingNumber}`,
  };

  return jsonResponse(response, 201);
}
