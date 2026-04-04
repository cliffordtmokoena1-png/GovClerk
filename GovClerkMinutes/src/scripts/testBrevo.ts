import { createMocks } from "node-mocks-http";
import { NextApiRequest, NextApiResponse } from "next";
import { hideBin } from "yargs/helpers";
import yargs from "yargs/yargs";
import handler from "@/pages/api/brevo-webhook";

const TEST_WEBHOOK_EVENTS = {
  delivered: {
    event: "delivered",
    email: "testlead123@gmail.com",
    id: 1,
    date: "2025-06-09T18:42:42.000Z",
    ts: 1749498162,
    "message-id": "<test-message-id@brevo.com>",
    tag: "signup_urgent",
    ts_event: 1749498162,
    subject: "How long does it take your team to write meeting minutes?",
  },
  opened: {
    event: "opened",
    email: "testlead123@gmail.com",
    id: 2,
    date: "2025-06-09T19:00:00.000Z",
    ts: 1749499200,
    "message-id": "<test-message-id@brevo.com>",
    tag: "signup_urgent",
    ts_event: 1749499200,
    ts_epoch: 1749499200000,
    subject: "How long does it take your team to write meeting minutes?",
  },
  reply: {
    event: "reply",
    email: "testlead123@gmail.com",
    id: 3,
    date: "2025-06-09T20:00:00.000Z",
    ts: 1749502800,
    "message-id": "<test-message-id@brevo.com>",
    tag: "signup_urgent",
    ts_event: 1749502800,
    subject: "Re: How long does it take your team to write meeting minutes?",
    reply_subject: "Re: How long does it take your team to write meeting minutes?",
    reply_text: "Yes please, thanks!",
    reply_html: "<div>Yes please, thanks!</div>",
  },
};

type EventType = keyof typeof TEST_WEBHOOK_EVENTS;

async function fireWebhook(eventType: EventType, email: string) {
  const payload: Record<string, any> = JSON.parse(JSON.stringify(TEST_WEBHOOK_EVENTS[eventType]));

  // update email field to the email we received
  payload.email = email;

  const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
    method: "POST",
    url: "/api/brevo-webhook",
    body: payload,
  });

  const originalEnd = res.end.bind(res);
  res.end = (chunk?: any) => {
    console.log(`✔  Handler returned ${res._getStatusCode()}`);
    return originalEnd(chunk);
  };

  await handler(req as any, res);
}

yargs(hideBin(process.argv))
  .scriptName("test:brevo")
  .command(
    "delivered <email>",
    "Simulate Brevo delivered webhook",
    (y) => y.positional("email", { type: "string", describe: "Email of the contact" }),
    (argv) => {
      fireWebhook("delivered", argv.email as string).catch((e) => {
        console.error(e);
        process.exit(1);
      });
    }
  )
  .command(
    "opened <email>",
    "Simulate Brevo opened webhook",
    (y) => y.positional("email", { type: "string", describe: "Email of the contact" }),
    (argv) => {
      fireWebhook("opened", argv.email as string).catch((e) => {
        console.error(e);
        process.exit(1);
      });
    }
  )
  .command(
    "reply <email>",
    "Simulate Brevo reply webhook",
    (y) => y.positional("email", { type: "string", describe: "Email of the contact" }),
    (argv) => {
      fireWebhook("reply", argv.email as string).catch((e) => {
        console.error(e);
        process.exit(1);
      });
    }
  )
  .demandCommand(1, "You must specify a sub-command.")
  .strict()
  .help().argv;
