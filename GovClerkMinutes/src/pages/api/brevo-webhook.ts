import { NextApiRequest, NextApiResponse } from "next";
import withErrorReporting from "@/error/withErrorReporting";
import { getEmail, BrevoWebhook, isKnownBody } from "@/brevo/webhook";
import hubspot from "@/crm/hubspot/index";
import { associateContactWithEmail, associateContactWithTask } from "@/crm/hubspot/associations";
import { HUBSPOT_OWNER_IDS, OUTGOING_BCC_EMAIL } from "@/crm/hubspot/consts";
import { sendTransactionalEmail } from "@/brevo/emails";
import { getOutboundBurnerHandoffHtml, getOutboundBurnerHandoffText } from "@/brevo/emailCopy";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).end(); // Method Not Allowed
  }

  const body = req.body as BrevoWebhook.Body;
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
      timestamp: body.date,
      noteBody: `Email event: ${body.event}`,
    });
    return res.status(200).end();
  }

  switch (body.event) {
    case "request":
    case "delivered": {
      // Informational events — no action needed
      break;
    }
    case "opened":
    case "clicked": {
      // Track engagement in HubSpot as a note
      await hubspot.createNote({
        timestamp: body.date,
        noteBody: `Brevo email event: ${body.event}${body.event === "clicked" ? ` — ${(body as BrevoWebhook.Clicked).link}` : ""}`,
      });
      break;
    }
    case "hard_bounce":
    case "soft_bounce":
    case "unsubscribed":
    case "complaint": {
      await hubspot.createNote({
        timestamp: body.date,
        noteBody: `Brevo email event: ${body.event}`,
      });
      break;
    }
    case "reply": {
      const replyBody = body as BrevoWebhook.Reply;
      const sdr = HUBSPOT_OWNER_IDS.CLIFF_MOKOENA;

      const emailId = await hubspot.createEmail({
        direction: "INCOMING",
        subject: replyBody.reply_subject ?? body.subject ?? "Re: GovClerkMinutes",
        senderAddress: email,
        senderName: contact.properties.firstname ?? undefined,
        receiverAddress: OUTGOING_BCC_EMAIL,
        text: replyBody.reply_text ?? "",
        html: replyBody.reply_html ?? "",
        timestamp: body.date,
        ownerId: contact.properties.hubspot_owner_id ?? undefined,
      });

      await associateContactWithEmail({
        contactId: contact.id,
        emailId,
      });

      const taskId = await hubspot.createTask({
        taskSubject: `Follow up on email reply from ${contact.properties.email}`,
        taskBody: `Reply received from ${email} via Brevo`,
        taskType: "EMAIL",
        taskDueDate: new Date(),
        ownerId: sdr.id,
      });

      await associateContactWithTask({
        contactId: contact.id,
        taskId,
      });

      // Send handoff reply via Brevo transactional email
      await sendTransactionalEmail({
        to: [{ email }, { email: sdr.email }],
        sender: { email: OUTGOING_BCC_EMAIL, name: "GovClerk" },
        subject: replyBody.reply_subject ?? "Re: GovClerkMinutes",
        textContent: getOutboundBurnerHandoffText(sdr.firstname),
        htmlContent: getOutboundBurnerHandoffHtml(sdr.firstname),
        bcc: [{ email: OUTGOING_BCC_EMAIL }],
      });
      break;
    }
  }

  return res.status(200).end();
}

export default withErrorReporting(handler);
