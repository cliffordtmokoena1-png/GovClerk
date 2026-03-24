import { connect } from "@planetscale/database";
import hubspot from "@/crm/hubspot";
import { assertString } from "@/utils/assert";
import { capture } from "@/utils/posthog";
import { asUtcDate } from "@/utils/date";
import { serializeFilters } from "@/admin/whatsapp/filter/filters";
import type { Filter } from "@/admin/whatsapp/filter/types";

type WhatsappRow = {
  id: number;
  created_at: Date;
  operator_email: string | null;
  sender: string | null;
  whatsapp_id: string;
  conversation_id: string;
  type: string;
  text: string | null;
  user_id: string | null;
};

function getFirstOwner(convo: WhatsappRow[]): string | null {
  for (const msg of convo) {
    if (msg.operator_email != null) {
      return msg.operator_email;
    }
  }
  return null;
}

function getWatiInboxUrl(conversationId: string): string {
  return `https://live.wati.io/461839/teamInbox/${conversationId}`;
}

function getAdminPermalinkForWhatsapp(whatsappId: string): string {
  const f = serializeFilters([{ type: "phone", value: whatsappId }]);
  return `https://GovClerkMinutes.com/admin?tool=5&f=${encodeURIComponent(f)}`;
}

function createTranscript(convo: WhatsappRow[]): string {
  return convo
    .map((row) => {
      const timestamp = new Date(row.created_at).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/New_York",
        hour12: false,
        timeZoneName: "short",
      });
      const sender = row.sender ?? "Unknown";
      const text = row.text ?? "";
      return `[${timestamp}] ${sender}: ${text}`;
    })
    .join("<br>");
}

async function markMessagesLogged(convo: WhatsappRow[]): Promise<void> {
  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  const ids = convo.map((row) => row.id);
  const vars = ids.map(() => "?").join(", ");

  await conn.execute(
    `
    UPDATE gc_whatsapps
    SET is_logged = 1
    WHERE id IN (${vars});
    `,
    [...ids]
  );
}

async function saveUserId(whatsappId: string, userId: string): Promise<void> {
  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  await conn.execute(
    `
    UPDATE gc_whatsapp_contacts
    SET user_id = ?
    WHERE whatsapp_id = ?;
    `,
    [whatsappId, userId]
  );
}

async function findUserId(convo: WhatsappRow[]): Promise<string | null> {
  const firstMessage = convo[0];
  const contact = await hubspot.getContact({
    filter: { propertyName: "phone", value: `+${firstMessage.whatsapp_id}` },
    returnedProperties: ["user_id"],
  });
  return contact?.properties.user_id ?? null;
}

function collateConversations(rows: WhatsappRow[]): Record<string, WhatsappRow[]> {
  const convos: Record<string, WhatsappRow[]> = {};
  for (const row of rows) {
    if (convos[row.conversation_id] == null) {
      convos[row.conversation_id] = [];
    }
    convos[row.conversation_id].push(row);
  }
  return convos;
}

export async function logWhatsappsToHubspot(): Promise<void> {
  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  // Find all conversations that have "gone quiet" for more than 15 minutes.
  // We log to Hubspot in batches to not log every message as its own activity.
  const rows = await conn
    .execute<WhatsappRow>(
      `
      SELECT
        w.id,
        w.created_at,
        w.operator_email,
        w.sender,
        w.whatsapp_id,
        w.conversation_id,
        w.type,
        w.text,
        c.user_id 
      FROM gc_whatsapps w
      LEFT JOIN gc_whatsapp_contacts c ON w.whatsapp_id = c.whatsapp_id
      WHERE w.is_logged = 0
        AND w.created_at >= NOW() - INTERVAL 7 DAY
        AND w.conversation_id IN (
          SELECT conversation_id
          FROM gc_whatsapps
          GROUP BY conversation_id
          HAVING MAX(created_at) < NOW() - INTERVAL 15 MINUTE
        )
      ORDER BY w.created_at;
      `,
      []
    )
    .then((result) =>
      result.rows.map((row) => ({
        ...row,
        created_at: asUtcDate(assertString(row.created_at)),
      }))
    );

  const convos = collateConversations(rows);
  for (const convo of Object.values(convos)) {
    const firstMessage = convo[0];
    let userId = firstMessage.user_id;
    if (userId == null) {
      userId = await findUserId(convo);
      if (userId == null) {
        // If we still don't have a user_id, we can't proceed.
        capture(
          "whatsapp_contact_missing",
          {
            whatsapp_id: firstMessage.whatsapp_id,
            conversation_id: firstMessage.conversation_id,
            created_at: firstMessage.created_at,
          },
          firstMessage.whatsapp_id
        );
        await markMessagesLogged(convo);
        continue;
      }
      await saveUserId(firstMessage.whatsapp_id, userId);
    }

    const ownerEmail = getFirstOwner(convo);
    const ownerId = ownerEmail && hubspot.getOwnerIdFromEmail(ownerEmail);
    const transcript = createTranscript(convo);
    const watiUrl = getWatiInboxUrl(firstMessage.conversation_id);
    const adminUrl = getAdminPermalinkForWhatsapp(firstMessage.whatsapp_id);
    const [contact, communicationId] = await Promise.all([
      hubspot.getContact({
        filter: { propertyName: "user_id", value: userId },
        returnedProperties: ["user_id"],
      }),
      hubspot.createCommunication({
        channel: "WHATS_APP",
        body: `<a href="${watiUrl}" target="_blank">🔗 Link to conversation</a><br><a href="${adminUrl}" target="_blank">🔗 Admin permalink</a><br>${transcript}`,
        timestamp: firstMessage.created_at,
        ...(ownerId && { ownerId }),
      }),
    ]);

    // If this is an old user, there may be no Hubspot contact found for them.
    if (contact) {
      await hubspot.associateContactWithCommunication({
        contactId: assertString(contact?.id),
        communicationId,
      });
    }

    await markMessagesLogged(convo);
  }
}
