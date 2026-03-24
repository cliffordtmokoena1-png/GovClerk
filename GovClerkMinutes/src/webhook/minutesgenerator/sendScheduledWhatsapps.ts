import { connect } from "@planetscale/database";
import whatsapp from "@/admin/whatsapp/api";
import { assertString } from "@/utils/assert";
import { capture, WHATSAPP_WEBHOOK_ANONYMOUS_ID } from "@/utils/posthog";

type Row = {
  id: number;
  whatsapp_id: string;
  template_id: string;
  variables: string | null;
  freeform: string | null;
  source: string;
  language: string | null;
  sender_user_id: string;
  template_body: string | null;
  business_whatsapp_id: string | null;
};

export async function sendScheduledWhatsapps(): Promise<void> {
  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  // Send scheduled whatsapps in a loop, one at a time.  Why one at a time?
  // Because if a send fails, it will throw and the transaction will rollback.
  // This leads to a double send later on if the batch size is bigger than 1.
  // Why use a transaction?  Because local dev servers can hit this endpoint in
  // fast succession.  This can cause races if we don't lock the rows.
  let processed = 1;
  while (processed > 0) {
    processed = await conn.transaction(async (tx) => {
      // Lock a single eligible row; concurrent tx doing FOR UPDATE will wait.
      const rows = await tx
        .execute<Row>(
          `
          SELECT id, whatsapp_id, template_id, variables, freeform, source, language, sender_user_id, template_body, business_whatsapp_id
          FROM gc_scheduled_whatsapps
          WHERE is_sent = 0
            AND send_at <= NOW()
          ORDER BY send_at ASC
          LIMIT 1
          FOR UPDATE;
          `
        )
        .then((r) => r.rows);

      if (rows.length === 0) {
        return 0;
      }

      const {
        id,
        whatsapp_id,
        template_id,
        variables,
        freeform,
        source,
        language,
        sender_user_id,
        template_body,
        business_whatsapp_id,
      } = rows[0];

      if (template_id && template_id.trim().length > 0) {
        const parsedVariables = Object.entries(variables ? JSON.parse(variables) : {}).map(
          ([name, value]) => ({
            name,
            value,
          })
        );

        switch (source) {
          case "wati": {
            console.error("Scheduled WhatsApp templates not supported for Wati");
            break;
          }
          case "whatsapp": {
            await whatsapp.sendTemplateMessage({
              businessWhatsappId: assertString(business_whatsapp_id),
              to: whatsapp_id,
              templateName: template_id,
              templateBody: assertString(template_body),
              adminUserId: sender_user_id,
              language: language ?? "en",
              parameterFormat: "NAMED",
              parameters: parsedVariables as any,
            });
            break;
          }
          default:
            console.error("Unknown source for scheduled WhatsApp:", source);
        }
      } else if (freeform && freeform.trim().length > 0) {
        switch (source) {
          case "wati": {
            console.error("Scheduled WhatsApp freeform messages not supported for Wati");
            break;
          }
          case "whatsapp": {
            await whatsapp
              .sendMessage({
                type: "text",
                adminUserId: sender_user_id,
                businessWhatsappId: assertString(business_whatsapp_id),
                to: whatsapp_id,
                body: freeform,
              })
              .catch((err) => {
                console.error("Error sending scheduled Whatsapp message:", err);
                capture(
                  "whatsapp_scheduled_send_error",
                  { error: err },
                  WHATSAPP_WEBHOOK_ANONYMOUS_ID
                );
              });
            break;
          }
          default:
            console.error("Unknown source for scheduled WhatsApp:", source);
        }
      } else {
        // Nothing to send; treat as sent to avoid infinite loop.
      }

      await tx.execute(
        `
        UPDATE gc_scheduled_whatsapps
        SET is_sent = 1
        WHERE id = ?;
        `,
        [id]
      );

      return 1;
    });
  }
}
