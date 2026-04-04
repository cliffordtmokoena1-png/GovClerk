import { connect, type Connection } from "@planetscale/database";
import { createSignInToken } from "@/utils/clerk";
import { BREVO_LISTS } from "@/brevo/lists";
import {
  getContactByEmail,
  updateContact,
} from "@/brevo/contacts";
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

  console.warn(`adding lead to paywall_abandonment list: ${lead.email}`);

  if (!lead.email) {
    console.warn(`No email for user ${lead.userId}, skipping Brevo update`);
    return;
  }

  const leadInfo = await conn
    .execute<{
      first_name: string | null;
      phone: string | null;
    }>("SELECT first_name, phone FROM gc_leads WHERE user_id = ?", [lead.userId])
    .then((r) => r.rows?.[0] ?? null);

  if (!leadInfo) {
    console.warn(`Lead info not found for user ${lead.userId}`);
    return;
  }

  // Fetch existing contact attributes from Brevo
  let existingAttributes: Record<string, any> = {};
  try {
    const brevoContact = await getContactByEmail(lead.email);
    existingAttributes = brevoContact?.attributes ?? {};
  } catch {
    // Contact may not exist yet; we'll create/update it below
  }

  const attributes: Record<string, any> = { ...existingAttributes };

  // Ensure signInToken exists
  if (attributes.SIGN_IN_TOKEN == null) {
    const signInToken = await createSignInToken(lead.userId);
    if (!signInToken) {
      throw new Error(
        `[handlePaywallAbandoners] Failed to create Clerk sign-in token for userId=${lead.userId}`
      );
    }
    attributes.SIGN_IN_TOKEN = signInToken;
  }

  attributes.TRANSCRIPT_ID = String(transcriptId);

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
    attributes.RECORDING_LENGTH_SNIPPET = formatRecordingLength(
      Number(transcriptRow.credits_required)
    );
    attributes.UPLOAD_NAME = transcriptRow.title;
  }

  if (leadInfo.first_name != null) {
    attributes.FIRSTNAME = leadInfo.first_name;
  }

  if (leadInfo.phone != null) {
    attributes.SMS = leadInfo.phone;
  }

  await updateContact(lead.email, {
    attributes,
    listIds: [BREVO_LISTS.PAYWALL_ABANDONERS],
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
      console.error("failed to add contact to Brevo:", e);
      await capture(
        "email_lead_add_failed",
        {
          transcript_id: emailInfo.transcript_id,
          user_id: emailInfo.user_id,
          email: emailInfo.email,
          brevo_err: String(e),
        },
        GC_WEBHOOK_ANONYMOUS_ID
      );
    }
  }
}
