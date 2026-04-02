// We removed 'posthog-node' because it crashes Vercel Edge builds
import { isDev } from "./dev";

export const TRAINING_REMINDER_ANONYMOUS_ID = "training_reminder";
export const WATI_WEBHOOK_ANONYMOUS_ID = "wati_webhook";
export const GC_WEBHOOK_ANONYMOUS_ID = "gc_webhook";
export const CLERK_WEBHOOK_ANONYMOUS_ID = "clerk_webhook";
export const WHATSAPP_WEBHOOK_ANONYMOUS_ID = "whatsapp_webhook";

// Keep all your event names exactly as they were
export type PostHogEvent =
  | "api_toplevel_error"
  | "api_toplevel_bad_status_code"
  | "conversions_api_called"
  | "user_signup_webhook"
  | "transcribe_started"
  | "file_uploaded"
  | "file_segmented"
  | "transcribe_paused"
  | "user_magic_email_sent"
  | "user_magic_email_failed"
  | "user_purchase"
  | "transcript_deleted"
  | "transcript_renamed"
  | "s3_lambda_webhook_called"
  | "s3_lambda_webhook_failed"
  | "dashboard_get_serverside_props"
  | "subscription_canceled"
  | "subscription_renewed"
  | "whatsapp_contact_missing"
  | "whatsapp_error_stopping_email"
  | "whatsapp_inbound"
  | "whatsapp_inbound_error"
  | "whatsapp_outgoing_status"
  | "whatsapp_outgoing_status_error"
  | "whatsapp_scheduled_send_error"
  | "training_reminder"
  | "admin_upload_created"
  | "recording_started"
  | "recording_stopped"
  | "recording_paused"
  | "recording_resumed"
  | "recording_permission_denied"
  | "recording_error"
  | "recording_completed"
  | "recording_recovered"
  | "email_lead_added"
  | "email_lead_add_failed"
  | "post_signup_task_failed"
  | "account_deleted"
  | "custom_template_deleted"
  | "agenda_title_updated"
  | "agenda_exported"
  | "agenda_feedback_sent"
  | "quote_request_submitted"
  | "quote_request_failed"
  | "quote_request_blocked_personal_email"
  | "quote_request_hcaptcha_failed"
  | "ai_agent_reply"
  | "ai_agent_escalation"
  | "ai_agent_sales_escalation"
  | "ai_agent_error";

export async function capture(event: PostHogEvent, properties: any, distinctId: string) {
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!apiKey) {
    if (isDev()) {
      console.warn("[posthog] NEXT_PUBLIC_POSTHOG_KEY is not set, skipping capture");
    }
    return;
  }
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://app.posthog.com";

  // We use 'fetch' here because it works on Vercel Edge (Middleware)
  try {
    await fetch(`${host}/capture/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: apiKey,
        event: event,
        properties: {
          ...properties,
          distinct_id: distinctId,
          $lib: "web-fetch-edge",
        },
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (e) {
    if (isDev()) {
      console.error("PostHog capture failed:", e);
    }
  }
}
