import { connect } from "@planetscale/database";
import { addSignupLead } from "./addSignupLead";
import { capture, GC_WEBHOOK_ANONYMOUS_ID } from "@/utils/posthog";
import { sendCompleteRegistrationConversionEvent } from "@/meta/sendCompleteRegistrationConversionEvent";
import { sendLeadWelcome } from "@/ai-agent/sendLeadWelcome";

export type PostSignupLead = {
  id: number;
  email: string;
  user_id: string;
  campaign: string;
  first_name?: string;
  phone?: string;
  transcript_id?: number;
  minutes_freq?: string;
  minutes_due?: string;
  has_whatsapp_inbound: number;
};

export async function runPostSignupTasks(): Promise<void> {
  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  const leads = await conn
    .execute<PostSignupLead>(
      `
      SELECT
      e.id,
      e.email,
      e.user_id,
      e.campaign,
      l.first_name,
      l.phone,
      e.transcript_id,
      l.minutes_freq,
      l.minutes_due,
      CASE
        WHEN wc.id IS NOT NULL THEN 1
        ELSE 0
      END AS has_whatsapp_inbound
      FROM gc_emails e
      JOIN gc_leads l ON e.user_id = l.user_id
      LEFT JOIN gc_whatsapp_contacts wc ON wc.user_id = l.user_id
      WHERE TIMESTAMPDIFF(MINUTE, e.created_at, UTC_TIMESTAMP()) >= 5
        AND e.should_email = 1
        AND e.campaign = 'signup_urgent'
      `
    )
    .then((r) =>
      r.rows.map((row) => ({
        ...row,
        has_whatsapp_inbound: Number(row.has_whatsapp_inbound),
      }))
    );

  for (const lead of leads) {
    try {
      // Mark this so we only process the lead once
      await conn.execute("UPDATE gc_emails SET should_email = 0 WHERE id = ?", [lead.id]);

      // Send meta conversion event
      await sendCompleteRegistrationConversionEvent(lead.user_id);

      // Add contact to Brevo signup email list
      await addSignupLead(lead);

      // If the lead didn't message us on WhatsApp, message them
      if (lead.has_whatsapp_inbound === 0 && lead.phone && lead.first_name) {
        const whatsappId = lead.phone.replace(/\D/g, "");
        const name = lead.first_name;

        void sendLeadWelcome({
          phone: whatsappId,
          firstName: name,
          templateName: "samantha_organic_welcome",
          templateBody:
            "Hi {{first_name}}! 👋 I'm Samantha, your GovClerk assistant.\n\nI noticed you signed up — welcome! I'm here to help you get started. To make sure we set things up right for your organisation, mind if I ask a few quick questions?",
          parameters: { first_name: name },
          leadSource: "organic_signup",
          userId: lead.user_id,
        });
      }
    } catch (error) {
      console.error(`Post signup task failed for ${lead.email}:`, error);
      capture(
        "post_signup_task_failed",
        {
          user_id: lead.user_id,
          email: lead.email,
          error: String(error),
        },
        GC_WEBHOOK_ANONYMOUS_ID
      );
    }
  }
}
