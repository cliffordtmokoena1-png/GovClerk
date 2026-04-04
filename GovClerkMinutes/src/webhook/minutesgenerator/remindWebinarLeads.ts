import { BREVO_LISTS } from "@/brevo/lists";
import { getContactsFromList } from "@/brevo/contacts";
import { assertString } from "@/utils/assert";
import { asUtcDate } from "@/utils/date";
import { connect } from "@planetscale/database";
import { sendEmail } from "@/utils/postmark";
import { getWebinarLeadFromDb, updateWebinarLeadInDb } from "@/crm/webinarLeads";

async function getMostRecentWebinarEventTime(): Promise<Date> {
  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  const results = await conn
    .execute<{
      event_time: string;
    }>(
      `
      SELECT event_time
      FROM gc_events
      ORDER BY event_time DESC
      LIMIT 1
      `
    )
    .then((r) => r.rows);

  const eventTime = assertString(results[0]?.event_time);
  return asUtcDate(eventTime);
}

async function sendWebinarReminderEmail(email: string, firstName: string, eventUrl: string) {
  await sendEmail({
    From: '"Max from GovClerkMinutes" <max@mail.GovClerkMinutes.com>',
    To: email,
    Subject: "Free training starting NOW!",
    HtmlBody: `<p>${firstName}, it's finally time!</p>
      <p><a href="${eventUrl}">Click this to join the livestream!</a></p>
      <p>See you there,</p>
      <p>Max Sherman</p>`,
    TextBody: `${firstName}, it's finally time!\n\nJoin the livestream: ${eventUrl}\n\nSee you there,\nMax Sherman`,
    MessageStream: "outbound",
  });
}

type WebinarLead = {
  id: number;
  email: string;
  attributes?: {
    FIRSTNAME?: string;
    EVENT_URL?: string;
  };
};

export async function remindWebinarLeads(): Promise<void> {
  const eventTime = await getMostRecentWebinarEventTime();
  if (!eventTime) {
    return;
  }

  const now = new Date();
  const diffMinutes = (eventTime.getTime() - now.getTime()) / (1000 * 60);
  if (diffMinutes > 30) {
    return;
  }

  const leads = await getContactsFromList<WebinarLead>(BREVO_LISTS.WEBINAR_01);

  for (const lead of leads) {
    // Check to make sure we only email once.
    const webinarLead = await getWebinarLeadFromDb(lead.email);
    if (webinarLead == null || webinarLead.isReminded) {
      continue;
    }

    await updateWebinarLeadInDb({
      email: lead.email,
      isReminded: true,
    });

    const firstName = lead.attributes?.FIRSTNAME;
    const eventUrl = lead.attributes?.EVENT_URL;
    if (!firstName || !eventUrl) {
      continue;
    }

    await sendWebinarReminderEmail(lead.email, firstName, eventUrl);
    // await removeContactFromList(lead.email, BREVO_LISTS.WEBINAR_01);
  }
}
