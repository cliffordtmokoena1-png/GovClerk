import whatsapp from "@/admin/whatsapp/api";
import { NamedTemplateParameter } from "@/admin/whatsapp/api/templates";
import hubspot from "@/crm/hubspot";
import { upsertLeadToDb } from "@/crm/leads";
import { LeadSource } from "@/crm/hubspot/types";
import { v4 as uuidv4 } from "uuid";

/** Prefix for user IDs auto-generated from inbound WhatsApp-only contacts. */
const WHATSAPP_USER_ID_PREFIX = "wa_";

/** Default business WhatsApp number (ZA). Override via WHATSAPP_DEFAULT_BUSINESS_NUMBER env var. */
const DEFAULT_BUSINESS_WHATSAPP_NUMBER = "27664259236";

export interface SendLeadWelcomeParams {
  /** Destination phone in E.164 format (digits only, no +). */
  phone: string;
  firstName: string;
  templateName: string;
  /** Template body text (for logging only – actual body lives in Meta). */
  templateBody: string;
  /** Named parameters to inject into the template body. */
  parameters: Record<string, string>;
  leadSource: LeadSource;
  organizationName?: string;
  /** Existing Clerk user ID. If omitted, a new wa_-prefixed ID is auto-generated. */
  userId?: string;
}

/**
 * Sends a WhatsApp welcome template to a new lead and ensures they are tracked
 * in the database and HubSpot.
 *
 * All side-effects are wrapped in try/catch so a failure (e.g. template not yet
 * approved by Meta) never blocks the primary user flow.
 */
export async function sendLeadWelcome({
  phone,
  firstName,
  templateName,
  templateBody,
  parameters,
  leadSource,
  organizationName,
  userId: providedUserId,
}: SendLeadWelcomeParams): Promise<void> {
  const businessWhatsappId =
    process.env.WHATSAPP_DEFAULT_BUSINESS_NUMBER ?? DEFAULT_BUSINESS_WHATSAPP_NUMBER;

  // System user ID used when writing the outbound message to gc_whatsapps.
  // getPrimaryEmail will return null for an unknown userId, which is acceptable
  // for system-initiated messages (operator_email stored as null).
  const adminUserId = process.env.WHATSAPP_SYSTEM_ADMIN_USER_ID ?? "system";

  // Normalize phone: strip any non-digit characters (including leading +)
  const normalizedPhone = phone.replace(/[^0-9]/g, "");

  if (!normalizedPhone) {
    console.warn(`[sendLeadWelcome] Skipping ${templateName}: no valid phone number provided`);
    return;
  }

  // Determine userId for DB / HubSpot tracking
  const userId = providedUserId ?? `${WHATSAPP_USER_ID_PREFIX}${uuidv4()}`;

  console.log(
    `[sendLeadWelcome] Processing lead: templateName=${templateName}, phone=${normalizedPhone}, userId=${userId}, leadSource=${leadSource}`
  );

  // 1. Upsert lead to DB so we have a record even before they reply
  try {
    await upsertLeadToDb({
      userId,
      phone: `+${normalizedPhone}`,
      firstName,
      organizationName,
    });
  } catch (err) {
    console.error(
      `[sendLeadWelcome] Failed to upsert lead to DB (phone=${normalizedPhone}):`,
      err
    );
  }

  // 2. Create / update HubSpot contact so the lead is visible in the CRM
  try {
    await hubspot.createContact({
      userId,
      phone: `+${normalizedPhone}`,
      firstName,
      organizationName,
      lead_source: leadSource,
    });
  } catch (err) {
    // HubSpot may return 409 if a contact with this email/phone already exists.
    // Log and continue — the existing contact record is sufficient.
    console.error(
      `[sendLeadWelcome] Failed to create HubSpot contact (phone=${normalizedPhone}):`,
      err
    );
  }

  // 3. Send WhatsApp template message to open the conversation with Samantha
  try {
    const namedParams: NamedTemplateParameter[] = Object.entries(parameters).map(
      ([name, value]) => ({ name, value })
    );

    await whatsapp.sendTemplateMessage({
      businessWhatsappId,
      to: normalizedPhone,
      templateName,
      templateBody,
      adminUserId,
      language: "en",
      parameterFormat: "NAMED",
      parameters: namedParams,
    });

    console.log(
      `[sendLeadWelcome] Sent template "${templateName}" to ${normalizedPhone} (leadSource=${leadSource})`
    );
  } catch (err) {
    // Template may not yet be approved by Meta, or another transient error occurred.
    // Log and move on — this must not block the primary user flow.
    console.error(
      `[sendLeadWelcome] Failed to send WhatsApp template "${templateName}" to ${normalizedPhone}:`,
      err
    );
  }
}
