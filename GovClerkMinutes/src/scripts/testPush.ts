import { Command } from "commander";
import { sendPushToAdmins } from "@/push/sendWebPush";

const program = new Command();

program
  .name("test-push")
  .description("Send a test Web Push to all admin subscriptions")
  .option("-t, --title <title>", "Notification title", "GovClerkMinutes")
  .option("-b, --body <body>", "Notification body", "Test push from CLI")
  .option("-u, --url <url>", "Open URL on click", "/admin?tool=5")
  .action(async (opts) => {
    await sendPushToAdmins({
      title: opts.title,
      body: opts.body,
      tag: "test-push",
      url: opts.url,
    }).catch((err) => console.error(err));
    console.log("Sent push to admin subscriptions (if any)");
  });

program.parseAsync();
