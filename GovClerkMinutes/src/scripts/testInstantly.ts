import { createMocks } from "node-mocks-http";
import { NextApiRequest, NextApiResponse } from "next";
import { hideBin } from "yargs/helpers";
import yargs from "yargs/yargs";
import handler from "@/pages/api/instantly-webhook";

const TEST_WEBHOOK_EVENTS = {
  email_sent: {
    timestamp: "2025-06-09T18:42:42.715Z",
    event_type: "email_sent",
    workspace: "8f3e798e-b9d1-4af4-89ca-205202b07ce0",
    campaign_id: "4ea94d08-5e9f-4d39-8e1b-0090ce895b82",
    unibox_url: null,
    campaign_name: "signup_urgent",
    email_account: "max@GovClerkMinutespartners.com",
    is_first: true,
    lead_email: "testlead123@gmail.com",
    email: "testlead123@gmail.com",
    phone: "+2755555555",
    website: "",
    campaign: "4ea94d08-5e9f-4d39-8e1b-0090ce895b82",
    lastName: "",
    firstName: "John",
    minutesDue: "2025-06-10 00:00:00",
    companyName: "",
    minutesFreq: "weekly",
    signInToken: "xyz",
    personalization: "",
    step: 1,
    variant: 2,
    email_subject: "meeting minutes question",
    email_html:
      "<div>Hey John - you said you need minutes soon.</div><div><br /></div><div>Can I help you use GovClerkMinutes?  You will be done in 5 minutes (instead of hours)</div><div><br /></div><div>Best,<br />Mercedez Muniz</div>",
  },
  reply_received: {
    timestamp: "2025-06-09T16:04:40.963Z",
    event_type: "reply_received",
    workspace: "8f3e798e-b9d1-4af4-89ca-205202b07ce0",
    campaign_id: "4ea94d08-5e9f-4d39-8e1b-0090ce895b82",
    unibox_url:
      "https://app.instantly.ai/app/unibox?thread_search=testlead123@gmail.com&selected_wks=8f3e798e-b9d1-4af4-89ca-205202b07ce0",
    campaign_name: "signup_urgent",
    email_account: "max@GovClerkMinutespartners.com",
    reply_text_snippet: "Yes please, thanks! \n\n",
    is_first: true,
    lead_email: "testlead123@gmail.com",
    email: "testlead123@gmail.com",
    phone: "+27555555555",
    website: "",
    campaign: "4ea94d08-5e9f-4d39-8e1b-0090ce895b82",
    lastName: "",
    firstName: "John",
    minutesDue: "2025-06-11 00:00:00",
    companyName: "",
    minutesFreq: "monthly",
    signInToken: "xyz",
    personalization: "",
    step: 1,
    variant: 2,
    reply_subject: "Re: meeting minutes question",
    reply_text:
      "Yes please, thanks!\n" +
      "\n" +
      "On Mon, Jun 9, 2025, 15:33 Mercedez Muniz <max@GovClerkMinutespartners.com>\n" +
      "wrote:\n" +
      "\n" +
      "> Hey John - you said you need minutes soon.\n" +
      ">\n" +
      "> Can I help you use GovClerkMinutes?  You will be done in 5 minutes\n" +
      "> (instead of hours)\n" +
      ">\n" +
      "> Best,\n" +
      "> Mercedez Muniz\n" +
      "> [image: line]\n",
    reply_html:
      '<div dir="auto">Yes please, thanks! </div><br><div class="gmail_quote gmail_quote_container"><div dir="ltr" class="gmail_attr">On Mon, Jun 9, 2025, 15:33 Mercedez Muniz &lt;<a href="mailto:max@GovClerkMinutespartners.com">max@GovClerkMinutespartners.com</a>&gt; wrote:<br></div><blockquote class="gmail_quote" style="margin:0 0 0 .8ex;border-left:1px #ccc solid;padding-left:1ex"><div>Hey John - you said you need minutes soon.</div><div><br></div><div>Can I help you use GovClerkMinutes?  You will be done in 5 minutes (instead of hours)</div><div><br></div><div>Best,<br>Mercedez Muniz</div>\n' +
      '<img src="https://proxsclimmed.com/signature/images/4h9rGasOl8G5JJ915vyPx.png" alt="line"></blockquote></div>\n',
  },
  lead_interested: {
    timestamp: "2025-06-11T10:46:06.862Z",
    event_type: "lead_interested",
    workspace: "8f3e798e-b9d1-4af4-89ca-205202b07ce0",
    campaign_id: "4ea94d08-5e9f-4d39-8e1b-0090ce895b82",
    unibox_url: null,
    campaign_name: "signup_urgent",
    reply_text_snippet: "Yes please\n\n",
    lead_email: "testlead123@gmail.com",
    email: "testlead123@gmail.com",
    phone: null,
    website: "",
    campaign: "4ea94d08-5e9f-4d39-8e1b-0090ce895b82",
    lastName: "",
    firstName: "John",
    companyName: "",
    signInToken: "xyz",
    personalization: "",
    step: 1,
    variant: 2,
    reply_subject: "Re: meeting minutes question",
    reply_text:
      "Yes please\n" +
      "\n" +
      "On Wed, Jun 11, 2025, 11:34 AM Mercedez Muniz <\n" +
      "max.sherman@workGovClerkMinutes.com> wrote:\n" +
      "\n" +
      "> Hey John - you said you need minutes soon.\n" +
      ">\n" +
      "> Can I help you use GovClerkMinutes?  You will be done in 5 minutes\n" +
      "> (instead of hours)\n" +
      ">\n" +
      "> Best,\n" +
      "> Mercedez Muniz\n" +
      "> [image: line]\n",
    reply_html:
      '<div dir="auto">Yes please</div><br><div class="gmail_quote gmail_quote_container"><div dir="ltr" class="gmail_attr">On Wed, Jun 11, 2025, 11:34 AM Mercedez Muniz &lt;<a href="mailto:max.sherman@workGovClerkMinutes.com">max.sherman@workGovClerkMinutes.com</a>&gt; wrote:<br></div><blockquote class="gmail_quote" style="margin:0 0 0 .8ex;border-left:1px #ccc solid;padding-left:1ex"><div>Hey John - you said you need minutes soon.</div><div><br></div><div>Can I help you use GovClerkMinutes?  You will be done in 5 minutes (instead of hours)</div><div><br></div><div>Best,<br>Mercedez Muniz</div>\n' +
      '<img src="https://inst.workGovClerkMinutes.com/signature/images/aGz2uLJM-C6fwebclNRCX.png" alt="line"></blockquote></div>\n',
  },
};

type EventType = keyof typeof TEST_WEBHOOK_EVENTS;

async function fireWebhook(eventType: EventType, email: string) {
  const payload: Record<string, any> = JSON.parse(JSON.stringify(TEST_WEBHOOK_EVENTS[eventType]));

  // update all relevant fields to the email we received
  ["lead_email", "email"].forEach((k) => {
    if (k in payload) payload[k] = email;
  });

  const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
    method: "POST",
    url: "/api/instantly-webhook",
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
  .scriptName("test:instantly")
  .command(
    "email_sent <email>",
    "Simulate Instantly email_sent webhook",
    (y) => y.positional("email", { type: "string", describe: "Email of the lead" }),
    (argv) => {
      fireWebhook("email_sent", argv.email as string).catch((e) => {
        console.error(e);
        process.exit(1);
      });
    }
  )
  .command(
    "reply_received <email>",
    "Simulate Instantly reply_received webhook",
    (y) => y.positional("email", { type: "string", describe: "Email of the lead" }),
    (argv) => {
      fireWebhook("reply_received", argv.email as string).catch((e) => {
        console.error(e);
        process.exit(1);
      });
    }
  )
  .command(
    "lead_interested <email>",
    "Simulate Instantly reply_received webhook",
    (y) => y.positional("email", { type: "string", describe: "Email of the lead" }),
    (argv) => {
      fireWebhook("lead_interested", argv.email as string).catch((e) => {
        console.error(e);
        process.exit(1);
      });
    }
  )
  .demandCommand(1, "You must specify a sub-command.")
  .strict()
  .help().argv;
