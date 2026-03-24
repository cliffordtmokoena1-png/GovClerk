import { createClerkClient } from "@clerk/nextjs/server";
import { getClerkKeysFromEnv } from "@/utils/clerk";
import { assertString } from "@/utils/assert";
import type { Site } from "@/utils/site";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

const VALID_SITES: Site[] = ["GovClerkMinutes", "GovClerk"];

async function setAdmin(
  userId: string,
  isDev: boolean,
  site: Site,
  isAdmin: boolean
): Promise<void> {
  const keys = getClerkKeysFromEnv(isDev ? "dev" : "prod", site);
  const client = createClerkClient(keys);

  await client.users.updateUserMetadata(userId, {
    publicMetadata: {
      role: isAdmin ? "admin" : null,
    },
  });

  console.log(
    `Set user ${userId} role to: ${isAdmin ? "admin" : "null"} (${site}, ${isDev ? "dev" : "prod"})`
  );
}

const siteOption = {
  describe: "Which site's Clerk instance to use",
  type: "string" as const,
  choices: VALID_SITES,
  default: "GovClerkMinutes" as Site,
};

const devOption = {
  describe: "Whether to use Dev Keys",
  type: "boolean" as const,
  default: false,
};

yargs(hideBin(process.argv))
  .command(
    "grant <user_id>",
    "Grant admin access to a user",
    (yargs) =>
      yargs
        .positional("user_id", {
          describe: "The user ID to grant admin rights",
          type: "string",
        })
        .option("dev", devOption)
        .option("site", siteOption),
    async (argv) => {
      await setAdmin(assertString(argv.user_id), argv.dev, argv.site as Site, true);
    }
  )
  .command(
    "revoke <user_id>",
    "Revoke admin access from a user",
    (yargs) =>
      yargs
        .positional("user_id", {
          describe: "The user ID to revoke admin rights from",
          type: "string",
        })
        .option("dev", devOption)
        .option("site", siteOption),
    async (argv) => {
      await setAdmin(assertString(argv.user_id), argv.dev, argv.site as Site, false);
    }
  )
  .help()
  .alias("help", "h")
  .demandCommand(1, "You need at least one command before moving on")
  .strict()
  .parse();
