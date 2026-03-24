import { CAMPAIGNS } from "@/instantly/campaigns";
import dotenv from "dotenv";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

dotenv.config({ path: ".env" });

yargs(hideBin(process.argv))
  .command(
    // "* <transcript_id>",
    "*",
    "???",
    (yargs) => {},
    // yargs.positional("transcript_id", {
    //   describe: "The ID of the transcript to download",
    //   type: "number",
    //   demandOption: true,
    // }),
    async (argv) => {
      console.log("hi");
      // build a query string

      const queryString = new URLSearchParams({
        // assigned_to: "123e4567-e89b-12d3-a456-426614174000",
        // campaign_id: "123e4567-e89b-12d3-a456-426614174000",
        // company_domain: "example.com",
        // eaccount: "jon%40example.com",
        // email_type: "received",
        // has_reminder: "true",
        // i_status: "1",
        // is_unread: "true",

        lead: "example@gmail.com",
        campiaign_id: CAMPAIGNS.SIGNUP_URGENT,
        sort_order: "desc",
      }).toString();

      // https://developer.instantly.ai/api/v2/email/listemail
      const data = await fetch("https://api.instantly.ai/api/v2/emails?" + queryString, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.INSTANTLY_V2_ALL_KEY!}`,
        },
      }).then((r) => r.json());

      console.log(JSON.stringify(data, null, 2));
    }
  )
  .help()
  .alias("help", "h").argv;
