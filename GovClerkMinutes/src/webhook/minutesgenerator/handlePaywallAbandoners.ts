import { connect, type Connection } from "@planetscale/database";
import { createAuthToken } from "@/auth/createAuthToken";
import { CAMPAIGNS } from "@/instantly/campaigns";
import {
  getLeadByInstantlyId,
  moveLeadByInstantlyId,
  updateLeadByInstantlyId,
} from "@/instantly/leads";
import { capture, GC_WEBHOOK_ANONYMOUS_ID } from "@/utils/posthog";
import { getLeadFromDb, MgLead } from "@/crm/leads";

function formatRecordingLength(tokens_required: number): string {
  const hours = Math.floor(tokens_required / 60);
  const minutes = tokens_required % 60;

  if (minutes < 15) {
    if (hours === 1) {
      return "over 1 hour";
    } else {
      return `over ${hours} hours`;
    }
  } else if (minutes < 45) {
    return `almost ${hours}.5 hours`;
  } else if (hours === 0) {
    return "almost 1 hour";
  } else {
    return `almost ${hours + 1} hours`;
  }
}

async function startPaywallAbandonmentEmailSequence(
  conn: Connection,
  lead: MgLead,
  transcriptId: number
): Promise<void> {
  // Skip if user already a customer
  const customerCount = await conn
    .execute<{
      cnt: number;
    }>("SELECT COUNT(*) AS cnt FROM gc_customers WHERE user_id = ?", [lead.userId])
    .then((r) => Number(r.rows?.[0]?.cnt ?? 0));

  if (customerCount > 0) {
    console.warn(`user ${lead.userId} already exists in gc_customers, skipping lead addition`);
    return;
  }

  console.warn(`adding lead to paywall_abandonment campaign: ${lead.email}`);

  const leadInfo = await conn
    .execute<{
      first_name: string | null;
      phone: string | null;
      instantly_id: string | null;
    }>("SELECT first_name, phone, instantly_id FROM gc_leads WHERE user_id = ?", [lead.userId])
    .then((r) => r.rows?.[0] ?? null);

  if (!leadInfo || !leadInfo.instantly_id) {
    console.warn(`instantly_id not found for user ${lead.userId}`);
    return;
  }

  const instantlyId = leadInfo.instantly_id;

  // Fetch existing payload/custom variables from Instantly
  const leadJson = await getLeadByInstantlyId(instantlyId);
  const variables: Record<string, any> = leadJson?.payload ?? {};
  const currentCampaign = leadJson?.campaign;

  // Ensure signInToken exists
  if (variables.signInToken == null) {
    const signInToken = await createAuthToken(lead.userId);
    variables.signInToken = signInToken;
  }

  variables.transcriptId = String(transcriptId);

  // Add recording length snippet and uploadName if available
  const transcriptRow = await conn
    .execute<{
      credits_required: number;
      title: string;
    }>("SELECT credits_required, title FROM transcripts WHERE id = ? AND userId = ?", [
      transcriptId,
      lead.userId,
    ])
    .then((r) => r.rows?.[0]);

  if (transcriptRow) {
    variables.recordingLengthSnippet = formatRecordingLength(
      Number(transcriptRow.credits_required)
    );
    variables.uploadName = transcriptRow.title;
  }

  await updateLeadByInstantlyId({
    instantlyId,
    firstName: leadInfo.first_name,
    phone: leadInfo.phone,
    customVariables: variables,
  });

  await moveLeadByInstantlyId({
    instantlyId,
    campaignId: currentCampaign,
    toCampaignId: CAMPAIGNS.PAYWALL_ABANDONERS,
  });
}

async function sendPaywallAbandonmentWhatsapp(lead: MgLead): Promise<void> {
  if (!lead.phone || !lead.firstName) {
    console.warn(`No phone or firstName for ${lead.email} skipping whatsapp paywall abandonment`);
    return;
  }
}

export async function handlePaywallAbandoners(): Promise<void> {
  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  type EmailRow = {
    id: number;
    email: string;
    user_id: string;
    campaign: string;
    transcript_id: number;
  };

  // Get gc_emails for paywall_abandonment older than >= 2 hours and still should_email
  const emailRows = await conn
    .execute<EmailRow>(
      `
      SELECT 
        e.id,
        e.email,
        e.user_id,
        e.campaign,
        e.transcript_id
      FROM gc_emails e
      WHERE TIMESTAMPDIFF(HOUR, e.created_at, UTC_TIMESTAMP()) >= 2
        AND e.should_email = 1
        AND e.campaign = 'paywall_abandonment'
        AND e.transcript_id IS NOT NULL
      `
    )
    .then((r) => r.rows);

  // eslint-disable-next-line no-console
  console.log(`Found ${emailRows.length} paywall abandonment leads`);

  for (const emailInfo of emailRows) {
    try {
      // Mark as processed regardless of outcome to avoid repeats
      await conn.execute("UPDATE gc_emails SET should_email = 0 WHERE id = ?", [emailInfo.id]);

      const lead = await getLeadFromDb(emailInfo.user_id);
      if (!lead) {
        console.warn(`Lead not found for user ${emailInfo.user_id}`);
        continue;
      }

      await startPaywallAbandonmentEmailSequence(conn, lead, emailInfo.transcript_id);
      await sendPaywallAbandonmentWhatsapp(lead);

      await capture(
        "email_lead_added",
        {
          transcript_id: emailInfo.transcript_id,
          user_id: emailInfo.user_id,
          email: emailInfo.email,
          campaign: emailInfo.campaign,
        },
        GC_WEBHOOK_ANONYMOUS_ID
      );
    } catch (e) {
      console.error("failed to move lead to instantly:", e);
      await capture(
        "email_lead_add_failed",
        {
          transcript_id: emailInfo.transcript_id,
          user_id: emailInfo.user_id,
          email: emailInfo.email,
          instantly_err: String(e),
        },
        GC_WEBHOOK_ANONYMOUS_ID
      );
    }
  }
}
