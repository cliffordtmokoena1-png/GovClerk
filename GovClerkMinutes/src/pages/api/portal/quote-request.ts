/**
 * POST /api/portal/quote-request
 *
 * Stores a portal pricing quote request in gc_portal_quote_requests and
 * logs a notification (email/Slack integration can be added later).
 *
 * Body: {
 *   org_name, org_type, contact_name, contact_email,
 *   contact_phone?, estimated_seats?, estimated_monthly_meetings?,
 *   estimated_avg_meeting_duration_hours?,
 *   needs_live_streaming, needs_public_records, needs_document_archival, needs_govclerk_minutes,
 *   additional_notes?
 * }
 */

import { NextRequest } from "next/server";
import { getPortalDbConnection } from "@/utils/portalDb";
import { errorResponse, jsonResponse } from "@/utils/apiHelpers";

export const config = {
  runtime: "edge",
};

const VALID_ORG_TYPES = [
  "municipality",
  "school_board",
  "hoa",
  "county",
  "state_agency",
  "other",
] as const;

type OrgType = (typeof VALID_ORG_TYPES)[number];

interface QuoteRequestBody {
  org_name?: string;
  org_type?: OrgType;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  estimated_seats?: number;
  estimated_monthly_meetings?: number;
  estimated_avg_meeting_duration_hours?: number;
  needs_live_streaming?: boolean;
  needs_public_records?: boolean;
  needs_document_archival?: boolean;
  needs_govclerk_minutes?: boolean;
  additional_notes?: string;
}

export default async function handler(req: NextRequest): Promise<Response> {
  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  let body: QuoteRequestBody;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid request body", 400);
  }

  const {
    org_name,
    org_type,
    contact_name,
    contact_email,
    contact_phone,
    estimated_seats,
    estimated_monthly_meetings,
    estimated_avg_meeting_duration_hours,
    needs_live_streaming = false,
    needs_public_records = false,
    needs_document_archival = false,
    needs_govclerk_minutes = false,
    additional_notes,
  } = body;

  // Validate required fields
  if (!org_name?.trim()) {
    return errorResponse("org_name is required", 400);
  }
  if (!org_type || !VALID_ORG_TYPES.includes(org_type)) {
    return errorResponse("A valid org_type is required", 400);
  }
  if (!contact_name?.trim()) {
    return errorResponse("contact_name is required", 400);
  }
  if (!contact_email?.trim()) {
    return errorResponse("contact_email is required", 400);
  }

  const normalizedEmail = contact_email.trim().toLowerCase();

  // RFC-compliant email format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalizedEmail)) {
    return errorResponse("contact_email must be a valid email address", 400);
  }

  const conn = getPortalDbConnection();

  await conn.execute(
    `INSERT INTO gc_portal_quote_requests (
      org_name, org_type, contact_name, contact_email, contact_phone,
      estimated_seats, estimated_monthly_meetings, estimated_avg_meeting_duration_hours,
      needs_live_streaming, needs_public_records, needs_document_archival, needs_govclerk_minutes,
      additional_notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      org_name.trim(),
      org_type,
      contact_name.trim(),
      normalizedEmail,
      contact_phone?.trim() ?? null,
      estimated_seats ?? null,
      estimated_monthly_meetings ?? null,
      estimated_avg_meeting_duration_hours ?? null,
      needs_live_streaming ? 1 : 0,
      needs_public_records ? 1 : 0,
      needs_document_archival ? 1 : 0,
      needs_govclerk_minutes ? 1 : 0,
      additional_notes?.trim() ?? null,
    ]
  );

  // Log for now — email/Slack notifications can be wired up later
  console.log(
    `[portal/quote-request] New quote request from ${normalizedEmail} (${org_name.trim()}, ${org_type})`
  );

  return jsonResponse({ success: true, message: "Quote request received" }, 201);
}
