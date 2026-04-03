/**
 * POST /api/portal/quote-request
 *
 * Accepts both the legacy org-details format and the new portal-quote format
 * from the /portal/request-quote page.
 *
 * New format body: {
 *   firstName, lastName, email, phone, organizationName, websiteUrl?,
 *   selectedPlan?, estimatedSeats?, estimatedStreamingHours?,
 *   comments?, formType: "portal-quote"
 * }
 *
 * Legacy format body: {
 *   org_name, org_type, contact_name, contact_email, contact_phone?,
 *   estimated_seats?, estimated_monthly_meetings?,
 *   estimated_avg_meeting_duration_hours?,
 *   needs_live_streaming, needs_public_records, needs_document_archival,
 *   needs_govclerk_minutes, additional_notes?
 * }
 */

import { NextRequest } from "next/server";
import { getPortalDbConnection } from "@/utils/portalDb";
import { errorResponse, jsonResponse } from "@/utils/apiHelpers";
import { sendSlackWebhook } from "@/utils/slack";
import { getPhoneNumberIdFor, WHATSAPP_API_VERSION } from "@/admin/whatsapp/api/consts";
import { provisionProfessionalPlanTokens } from "@/utils/portalTokenProvisioning";
import { sendPortalProfessionalCrossSellEmail } from "@/utils/portalEmails";

const BUSINESS_WHATSAPP_ID = "27664259236";

/**
 * Sends a WhatsApp text message directly via the Meta Cloud API,
 * bypassing writeMessageToDb (which requires a Clerk admin user ID).
 */
async function sendWhatsAppNotification(to: string, body: string): Promise<boolean> {
  try {
    const phoneNumberId = getPhoneNumberIdFor(BUSINESS_WHATSAPP_ID);
    const url = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${phoneNumberId}/messages`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.META_WHATSAPP_BUSINESS_API_KEY}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        type: "text",
        to,
        text: { preview_url: false, body },
      }),
    });

    return res.ok;
  } catch {
    return false;
  }
}

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

const VALID_PLANS = ["Starter", "Professional", "Enterprise"] as const;

type OrgType = (typeof VALID_ORG_TYPES)[number];
type PlanTier = (typeof VALID_PLANS)[number];

interface NewQuoteBody {
  formType: "portal-quote";
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  organizationName?: string;
  websiteUrl?: string;
  selectedPlan?: PlanTier;
  estimatedSeats?: number;
  estimatedStreamingHours?: number;
  comments?: string;
}

interface LegacyQuoteBody {
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

type QuoteRequestBody = NewQuoteBody | LegacyQuoteBody;

function isNewFormat(body: QuoteRequestBody): body is NewQuoteBody {
  return (body as NewQuoteBody).formType === "portal-quote";
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  const conn = getPortalDbConnection();

  if (isNewFormat(body)) {
    // New portal-quote format
    const {
      firstName,
      lastName,
      email,
      phone,
      organizationName,
      websiteUrl,
      selectedPlan,
      estimatedSeats,
      estimatedStreamingHours,
      comments,
    } = body;

    if (!firstName?.trim()) return errorResponse("firstName is required", 400);
    if (!lastName?.trim()) return errorResponse("lastName is required", 400);
    if (!email?.trim()) return errorResponse("email is required", 400);
    if (!phone?.trim()) return errorResponse("phone is required", 400);
    if (!organizationName?.trim()) return errorResponse("organizationName is required", 400);

    const normalizedEmail = email.trim().toLowerCase();
    if (!emailRegex.test(normalizedEmail)) {
      return errorResponse("email must be a valid email address", 400);
    }

    if (selectedPlan && !VALID_PLANS.includes(selectedPlan)) {
      return errorResponse("Invalid selectedPlan value", 400);
    }

    await conn.execute(
      `INSERT INTO gc_portal_quote_requests (
        org_name, contact_name, contact_email, contact_phone,
        estimated_seats, additional_notes, selected_plan, estimated_streaming_hours, website_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        organizationName.trim(),
        `${firstName.trim()} ${lastName.trim()}`,
        normalizedEmail,
        phone.trim() ?? null,
        estimatedSeats ?? null,
        comments?.trim() ?? null,
        selectedPlan ?? null,
        estimatedStreamingHours ?? null,
        websiteUrl?.trim() ?? null,
      ]
    );

    console.log(
      `[portal/quote-request] New portal-quote from ${normalizedEmail} (${organizationName.trim()}, plan: ${selectedPlan ?? "unspecified"})`
    );

    // Notify team via WhatsApp (best-effort) and Slack (always)
    const customerPhone = phone.trim().replace(/[^0-9]/g, "");
    let whatsappSent = false;
    const MIN_PHONE_LENGTH = 10;

    if (customerPhone.length >= MIN_PHONE_LENGTH) {
      const waMessage =
        `Hi ${firstName.trim()}! 👋\n\n` +
        `Thank you for requesting a quote for *GovClerk Portal* for ${organizationName.trim()}.\n\n` +
        `We've received your inquiry${selectedPlan ? ` for the *${selectedPlan}* plan` : ""}. ` +
        `Samantha from our team will review your requirements and get back to you shortly with a tailored quote.\n\n` +
        `Feel free to ask any questions right here — I'm happy to help! 😊\n\n` +
        `— The GovClerk Team`;

      whatsappSent = await sendWhatsAppNotification(customerPhone, waMessage);
      if (whatsappSent) {
        console.log(`[portal/quote-request] WhatsApp message sent to ${customerPhone}`);
      } else {
        console.warn(`[portal/quote-request] WhatsApp send failed for ${customerPhone}`);
      }
    }

    try {
      const slackTitle = whatsappSent
        ? "🏛️ New Portal Quote Request (WhatsApp sent ✅)"
        : "🏛️ New Portal Quote Request (WhatsApp failed ❌ — follow up needed)";
      await sendSlackWebhook([
        {
          color: "#10B981",
          title: slackTitle,
          fields: [
            { title: "Contact", value: `${firstName.trim()} ${lastName.trim()}`, short: true },
            { title: "Email", value: normalizedEmail, short: true },
            { title: "Phone", value: phone.trim(), short: true },
            { title: "Organization", value: organizationName.trim(), short: true },
            { title: "Website", value: websiteUrl?.trim() || "Not provided", short: true },
            { title: "Selected Plan", value: selectedPlan || "Not specified", short: true },
            { title: "Est. Seats", value: estimatedSeats?.toString() || "Not specified", short: true },
            { title: "Est. Streaming Hours", value: estimatedStreamingHours?.toString() || "Not specified", short: true },
            { title: "Comments", value: comments?.trim() || "None", short: false },
          ],
          footer: `Portal Quote • ${new Date().toISOString()}`,
        },
      ]);
    } catch (slackErr) {
      console.error("[portal/quote-request] Slack notification failed:", slackErr);
    }

    // When the selected plan is Professional, kick off token provisioning and
    // send the cross-sell email so the admin knows about their included tokens.
    // NOTE: Once a Paystack webhook handler for portal subscriptions is wired up,
    // move these calls to the point where gc_portal_subscriptions.status is set
    // to 'active' and tier = 'professional', rather than at quote-request time.
    if (selectedPlan === "Professional" && normalizedEmail) {
      const insertResult = await conn
        .execute(
          "SELECT id FROM gc_portal_quote_requests WHERE contact_email = ? ORDER BY created_at DESC LIMIT 1",
          [normalizedEmail]
        )
        .then((r) => r.rows as { id: string }[])
        .catch(() => [] as { id: string }[]);

      const quoteOrgId = insertResult[0]?.id?.toString() ?? `quote_${Date.now()}`;

      // Fire off provisioning and cross-sell email; both catch their own errors internally.
      await Promise.allSettled([
        provisionProfessionalPlanTokens(quoteOrgId, normalizedEmail),
        sendPortalProfessionalCrossSellEmail(
          normalizedEmail,
          firstName?.trim(),
          organizationName?.trim()
        ),
      ]);
    }
  } else {
    // Legacy format
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
    } = body as LegacyQuoteBody;

    if (!org_name?.trim()) return errorResponse("org_name is required", 400);
    if (!org_type || !VALID_ORG_TYPES.includes(org_type)) {
      return errorResponse("A valid org_type is required", 400);
    }
    if (!contact_name?.trim()) return errorResponse("contact_name is required", 400);
    if (!contact_email?.trim()) return errorResponse("contact_email is required", 400);

    const normalizedEmail = contact_email.trim().toLowerCase();
    if (!emailRegex.test(normalizedEmail)) {
      return errorResponse("contact_email must be a valid email address", 400);
    }

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

    console.log(
      `[portal/quote-request] New quote request from ${normalizedEmail} (${org_name.trim()}, ${org_type})`
    );

    try {
      await sendSlackWebhook([
        {
          color: "#10B981",
          title: "🏛️ New Portal Quote Request (Legacy Form)",
          fields: [
            { title: "Contact", value: contact_name.trim(), short: true },
            { title: "Email", value: normalizedEmail, short: true },
            { title: "Phone", value: contact_phone?.trim() || "Not provided", short: true },
            { title: "Organization", value: org_name.trim(), short: true },
            { title: "Org Type", value: org_type, short: true },
            { title: "Est. Seats", value: estimated_seats?.toString() || "Not specified", short: true },
            { title: "Est. Monthly Meetings", value: estimated_monthly_meetings?.toString() || "Not specified", short: true },
            { title: "Est. Avg Duration (hrs)", value: estimated_avg_meeting_duration_hours?.toString() || "Not specified", short: true },
            { title: "Needs Live Streaming", value: needs_live_streaming ? "Yes" : "No", short: true },
            { title: "Needs Public Records", value: needs_public_records ? "Yes" : "No", short: true },
            { title: "Needs Doc Archival", value: needs_document_archival ? "Yes" : "No", short: true },
            { title: "Needs GovClerkMinutes", value: needs_govclerk_minutes ? "Yes" : "No", short: true },
            { title: "Notes", value: additional_notes?.trim() || "None", short: false },
          ],
          footer: `Portal Quote (Legacy) • ${new Date().toISOString()}`,
        },
      ]);
    } catch (slackErr) {
      console.error("[portal/quote-request] Slack notification failed (legacy):", slackErr);
    }
  }

  return jsonResponse({ success: true, message: "Quote request received" }, 201);
}
