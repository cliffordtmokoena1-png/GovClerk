import { NextApiRequest, NextApiResponse } from "next";
import withErrorReporting from "@/error/withErrorReporting";
import { getEmail, InstantlyWebhook, isKnownBody } from "@/instantly/webhook";
import hubspot from "@/crm/hubspot/index";
import { associateContactWithEmail, associateContactWithTask } from "@/crm/hubspot/associations";
import { HUBSPOT_OWNER_IDS, OUTGOING_BCC_EMAIL } from "@/crm/hubspot/consts";
import { listEmail, replyToEmail } from "@/instantly/emails";
import { assertString } from "@/utils/assert";
import { getOutboundBurnerHandoffHtml, getOutboundBurnerHandoffText } from "@/instantly/emailCopy";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).end(); // Method Not Allowed
  }

  const body = req.body as InstantlyWebhook.Body;
  console.info("Got wh body", body);

  const email = getEmail(body);
  if (email == null) {
    console.warn("Unknown body without email", body);
    return res.status(200).end();
  }

  let contact = null;
  try {
    contact = await hubspot.getContact({
      filter: {
        propertyName: "email",
        value: email,
      },
      returnedProperties: ["email", "firstname", "hubspot_owner_id"],
    });
  } catch (err) {
    console.error("Error fetching contact", err);
    return res.status(400).end();
  }

  if (contact == null) {
    console.warn("Unknown body with email but no contact found", body);
    return res.status(200).end();
  }

  if (!isKnownBody(body)) {
    await hubspot.createNote({
      timestamp: body.timestamp,
      noteBody: `Email event: ${body.event_type}`,
    });
    return res.status(200).end();
  }

  switch (body.event_type) {
    case "email_sent": {
      const id = await hubspot.createEmail({
        direction: "OUTGOING",
        subject: body.email_subject,
        senderAddress: body.email_account,
        receiverAddress: body.lead_email,
        receiverName: contact.properties.firstname ?? undefined,
        text: "",
        html: body.email_html,
        timestamp: body.timestamp,
        ownerId: contact.properties.hubspot_owner_id ?? undefined,
      });

      await associateContactWithEmail({
        contactId: contact.id,
        emailId: id,
      });
      break;
    }
    case "reply_received": {
      const id = await hubspot.createEmail({
        direction: "INCOMING",
        subject: body.reply_subject,
        senderAddress: body.lead_email,
        senderName: contact.properties.firstname ?? undefined,
        receiverAddress: body.email_account,
        text: body.reply_text,
        html: body.reply_html,
        timestamp: body.timestamp,
        ownerId: contact.properties.hubspot_owner_id ?? undefined,
      });

      await associateContactWithEmail({
        contactId: contact.id,
        emailId: id,
      });

      await associateContactWithTask({
        contactId: contact.id,
        taskId: await hubspot.createTask({
          taskSubject: `Follow up on email reply from ${contact.properties.email}`,
          taskBody: `<a href="${body.unibox_url}" target="_blank">Click here to open Unibox</a>`,
          taskType: "EMAIL",
          taskDueDate: new Date(),
          ownerId: HUBSPOT_OWNER_IDS.CLIFF_MOKOENA.id,
        }),
      });
      break;
    }
    case "lead_interested": {
      const sdr = HUBSPOT_OWNER_IDS.CLIFF_MOKOENA;

      // Wait 5 seconds listEmail to let instantly's backend become consistent
      await new Promise((resolve) => setTimeout(resolve, 5000));

      const emails = await listEmail({
        lead: assertString(getEmail(body)),
        campaignId: body.campaign_id,
        sortOrder: "desc",
      });
      const { id, eaccount } = emails.items[0];

      await replyToEmail({
        emailId: id,
        emailAccount: eaccount,
        subject: body.reply_subject ?? "Re: GovClerkMinutes",
        body: {
          text: getOutboundBurnerHandoffText(sdr.firstname),
          html: getOutboundBurnerHandoffHtml(sdr.firstname),
        },
        cc: [sdr.email, body.lead_email],
        bcc: [OUTGOING_BCC_EMAIL],
      });
      break;
    }
  }

  return res.status(200).end();
}

export default withErrorReporting(handler);
