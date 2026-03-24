import { createClerkClient } from "@clerk/nextjs/server";
import { getClerkKeysFromEnv } from "@/utils/clerk";
import { assertString } from "@/utils/assert";
import type { Site } from "@/utils/site";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

type PropertyName = "isEnterprise";

const BOOLEAN_PROPERTIES: PropertyName[] = ["isEnterprise"];
const VALID_SITES: Site[] = ["GovClerkMinutes", "GovClerk"];

function isEmail(input: string): boolean {
  return input.includes("@");
}

function buildClient(isDev: boolean, site: Site) {
  return createClerkClient(getClerkKeysFromEnv(isDev ? "dev" : "prod", site));
}

async function resolveUserId(userIdOrEmail: string, isDev: boolean, site: Site): Promise<string> {
  if (!isEmail(userIdOrEmail)) {
    return userIdOrEmail;
  }

  const client = buildClient(isDev, site);
  const users = await client.users.getUserList({
    emailAddress: [userIdOrEmail],
  });

  if (users.data.length === 0) {
    throw new Error(`No user found with email: ${userIdOrEmail}`);
  }

  if (users.data.length > 1) {
    throw new Error(`Multiple users found with email: ${userIdOrEmail}`);
  }

  const userId = users.data[0].id;
  console.log(`Resolved ${userIdOrEmail} => ${userId}`);
  return userId;
}

async function listUserProperties(userId: string, isDev: boolean, site: Site): Promise<void> {
  const client = buildClient(isDev, site);
  const user = await client.users.getUser(userId);
  console.log(`Properties for user ${userId}:`);
  console.info(user.publicMetadata);
}

async function setUserProperty(
  userId: string,
  isDev: boolean,
  site: Site,
  property: PropertyName,
  value: boolean
): Promise<void> {
  const client = buildClient(isDev, site);

  await client.users.updateUserMetadata(userId, {
    publicMetadata: {
      [property]: value,
    },
  });

  console.log(`Set user ${userId} property '${property}' to: ${value}`);
}

async function deleteUserProperty(
  userId: string,
  isDev: boolean,
  site: Site,
  property: PropertyName
): Promise<void> {
  const client = buildClient(isDev, site);

  await client.users.updateUserMetadata(userId, {
    publicMetadata: {
      [property]: null,
    },
  });

  console.log(`Deleted user ${userId} property '${property}'`);
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
    "list <user_id_or_email>",
    "List a user's public metadata properties",
    (yargs) =>
      yargs
        .positional("user_id_or_email", {
          describe: "The user ID or email address to list properties for",
          type: "string",
        })
        .option("dev", devOption)
        .option("site", siteOption),
    async (argv) => {
      const userIdOrEmail = assertString(argv.user_id_or_email);
      const site = argv.site as Site;
      const userId = await resolveUserId(userIdOrEmail, argv.dev, site);
      await listUserProperties(userId, argv.dev, site);
    }
  )
  .command(
    "set <user_id_or_email> <property> <value>",
    "Set a property on a user's public metadata",
    (yargs) =>
      yargs
        .positional("user_id_or_email", {
          describe: "The user ID or email address to update",
          type: "string",
        })
        .positional("property", {
          describe: "The property name to set",
          type: "string",
          choices: BOOLEAN_PROPERTIES,
        })
        .positional("value", {
          describe: "The value to set (true or false)",
          type: "string",
          choices: ["true", "false"],
        })
        .option("dev", devOption)
        .option("site", siteOption),
    async (argv) => {
      const userIdOrEmail = assertString(argv.user_id_or_email);
      const site = argv.site as Site;
      const userId = await resolveUserId(userIdOrEmail, argv.dev, site);
      const property = assertString(argv.property) as PropertyName;
      const value = argv.value === "true";
      await setUserProperty(userId, argv.dev, site, property, value);
    }
  )
  .command(
    "delete <user_id_or_email> <property>",
    "Delete a property from a user's public metadata",
    (yargs) =>
      yargs
        .positional("user_id_or_email", {
          describe: "The user ID or email address to update",
          type: "string",
        })
        .positional("property", {
          describe: "The property name to delete",
          type: "string",
          choices: BOOLEAN_PROPERTIES,
        })
        .option("dev", devOption)
        .option("site", siteOption),
    async (argv) => {
      const userIdOrEmail = assertString(argv.user_id_or_email);
      const site = argv.site as Site;
      const userId = await resolveUserId(userIdOrEmail, argv.dev, site);
      const property = assertString(argv.property) as PropertyName;
      await deleteUserProperty(userId, argv.dev, site, property);
    }
  )
  .help()
  .alias("help", "h")
  .demandCommand(1, "You need at least one command before moving on")
  .strict()
  .parse();
