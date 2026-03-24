import fs from "fs";
import dotenv from "dotenv";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { User } from "@clerk/nextjs/dist/types/server";
import { getClerkKeysFromEnv } from "@/utils/clerk";
import type { Site } from "@/utils/site";

dotenv.config();

const VALID_SITES: Site[] = ["GovClerkMinutes", "GovClerk"];

async function fetchAllUserEmails(isDev: boolean, site: Site) {
  const keys = getClerkKeysFromEnv(isDev ? "dev" : "prod", site);
  const apiKey = keys.secretKey;

  if (!apiKey) {
    throw new Error(
      `Missing Clerk secret key for ${site} (${isDev ? "dev" : "prod"}). Please set it in your .env file or environment variables.`
    );
  }

  const clerkApiUrl = "https://api.clerk.dev/v1/users";
  const limit = 100;
  let offset = 0;
  let hasMore = true;
  const allEmails: string[] = [];

  console.log("Fetching user emails from Clerk...");

  while (hasMore) {
    console.log(`- Fetching batch, offset: ${offset}`);

    const response = await fetch(`${clerkApiUrl}?limit=${limit}&offset=${offset}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch users. ${response.status} ${response.statusText}`);
    }

    const users = await response.json();

    users.forEach((user: any) => {
      if (user.email_addresses && user.email_addresses.length) {
        user.email_addresses.forEach((emailObj: any) => {
          allEmails.push(emailObj.email_address);
        });
      }
    });

    hasMore = users.length === limit;
    offset += limit;
  }

  console.log(`Fetched ${allEmails.length} emails in total.`);

  fs.writeFileSync("user_emails.csv", "emails\n" + allEmails.join(",\n"), "utf8");
  console.log("User emails saved to user_emails.csv");
}

yargs(hideBin(process.argv))
  .command(
    "download",
    "Download all user emails from Clerk and save them to user_emails.csv",
    (yargs) =>
      yargs
        .option("dev", {
          describe: "Whether to use Dev Keys",
          type: "boolean",
          default: false,
        })
        .option("site", {
          describe: "Which site's Clerk instance to use",
          type: "string",
          choices: VALID_SITES,
          default: "GovClerkMinutes" as Site,
        }),
    async (argv) => {
      try {
        await fetchAllUserEmails(argv.dev, argv.site as Site);
      } catch (error) {
        console.error(`Error: ${error}`);
        process.exit(1);
      }
    }
  )
  .help()
  .alias("help", "h")
  .demandCommand(1, "You need at least one command to run this script.")
  .strict()
  .parse();
