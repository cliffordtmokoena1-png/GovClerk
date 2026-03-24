import { createClerkClient } from "@clerk/backend";
import { getClerkKeysFromEnv } from "@/utils/clerk";
import { assertString } from "@/utils/assert";
import type { Site } from "@/utils/site";
import { connect } from "@planetscale/database";
import readline from "readline";
import dotenv from "dotenv";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

dotenv.config();

const VALID_SITES: Site[] = ["GovClerkMinutes", "GovClerk"];

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

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function deleteUserData(userId: string) {
  const results = {
    gc_customers: false,
    transcripts: false,
    minutes: false,
    gc_emails: false,
    payments: false,
    gc_templates: false,
    gc_meta_conversions: false,
  };

  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  try {
    await conn.execute("DELETE FROM gc_customers WHERE user_id = ?", [userId]);
    results.gc_customers = true;
  } catch (error) {
    console.error(
      "Failed to delete from gc_customers:",
      error instanceof Error ? error.message : "Unknown error"
    );
  }

  try {
    await conn.execute("DELETE FROM transcripts WHERE userId = ?", [userId]);
    results.transcripts = true;
  } catch (error) {
    console.error(
      "Failed to delete from transcripts:",
      error instanceof Error ? error.message : "Unknown error"
    );
  }

  try {
    await conn.execute("DELETE FROM minutes WHERE user_id = ?", [userId]);
    results.minutes = true;
  } catch (error) {
    console.error(
      "Failed to delete from minutes:",
      error instanceof Error ? error.message : "Unknown error"
    );
  }

  try {
    await conn.execute("DELETE FROM gc_emails WHERE user_id = ?", [userId]);
    results.gc_emails = true;
  } catch (error) {
    console.error(
      "Failed to delete from gc_emails:",
      error instanceof Error ? error.message : "Unknown error"
    );
  }

  try {
    await conn.execute("DELETE FROM payments WHERE user_id = ?", [userId]);
    results.payments = true;
  } catch (error) {
    console.error(
      "Failed to delete from payments:",
      error instanceof Error ? error.message : "Unknown error"
    );
  }

  try {
    await conn.execute("DELETE FROM gc_templates WHERE user_id = ?", [userId]);
    results.gc_templates = true;
  } catch (error) {
    console.error(
      "Failed to delete from gc_templates:",
      error instanceof Error ? error.message : "Unknown error"
    );
  }

  try {
    await conn.execute("DELETE FROM gc_meta_conversions WHERE user_id = ?", [userId]);
    results.gc_meta_conversions = true;
  } catch (error) {
    console.error(
      "Failed to delete from gc_meta_conversions:",
      error instanceof Error ? error.message : "Unknown error"
    );
  }

  return results;
}

async function promptForConfirmation(userId: string, userInfo?: any): Promise<boolean> {
  return new Promise((resolve) => {
    console.log("\x1b[31m%s\x1b[0m", "⚠️  WARNING: This operation is irreversible and dangerous!");

    if (userInfo) {
      console.log("\x1b[33m%s\x1b[0m", `You are about to delete the following user:`);
      console.log("\x1b[36m%s\x1b[0m", "User Information:");
      console.log(`- ID: ${userInfo.id}`);
      console.log(`- Email: ${userInfo.emailAddresses?.[0]?.emailAddress || "No email"}`);
      console.log(`- Username: ${userInfo.username || "No username"}`);
      console.log(`- First Name: ${userInfo.firstName || "Not provided"}`);
      console.log(`- Last Name: ${userInfo.lastName || "Not provided"}`);
      console.log(`- Created: ${new Date(userInfo.createdAt).toLocaleString()}`);
      console.log(
        `- Last Sign In: ${userInfo.lastSignInAt ? new Date(userInfo.lastSignInAt).toLocaleString() : "Never"}`
      );
    } else {
      console.log("\x1b[33m%s\x1b[0m", `⚠️  WARNING: User ${userId} not found in Clerk!`);
      console.log("\x1b[33m%s\x1b[0m", "Proceeding will only clean up database records.");
    }

    console.log("\n\x1b[33m%s\x1b[0m", "The following data will be deleted if found:");
    console.log("- Clerk user account");
    console.log("- Customer records");
    console.log("- Transcripts");
    console.log("- Minutes");
    console.log("- Emails");
    console.log("- Payment history");
    console.log("- Templates");
    console.log("- Meta conversion data");
    console.log("\x1b[31m%s\x1b[0m", "This action CANNOT be undone!");

    rl.question(
      'Are you absolutely sure you want to proceed? (type "yes" to confirm): ',
      (answer) => {
        resolve(answer.toLowerCase() === "yes");
        rl.close();
      }
    );
  });
}

async function deleteUser(userId: string, clerk: ReturnType<typeof createClerkClient>) {
  if (!userId) {
    console.error("Error: userId is required");
    process.exit(1);
  }

  const results = {
    clerk: false,
    database: {} as Record<string, boolean>,
  };

  try {
    let userInfo;
    try {
      userInfo = await clerk.users.getUser(userId);
    } catch (error) {
      console.log("\x1b[33m%s\x1b[0m", "Note: Failed to fetch user from Clerk");
    }

    const confirmed = await promptForConfirmation(userId, userInfo);
    if (!confirmed) {
      console.log("Operation canceled.");
      process.exit(0);
    }

    console.log("Proceeding with user deletion...");

    if (userInfo) {
      try {
        await clerk.users.deleteUser(userId);
        results.clerk = true;
        console.log("\x1b[32m%s\x1b[0m", "✓ Successfully deleted user from Clerk");
      } catch (error) {
        console.error(
          "\x1b[31m%s\x1b[0m",
          "Failed to delete user from Clerk:",
          error instanceof Error ? error.message : "Unknown error"
        );
      }
    }

    results.database = await deleteUserData(userId);

    console.log("\n\x1b[36m%s\x1b[0m", "Operation Results:");
    console.log("Clerk:", results.clerk ? "✓ Success" : "✗ Failed/Skipped");
    console.log("Database operations:");
    Object.entries(results.database).forEach(([table, success]) => {
      console.log(`- ${table}: ${success ? "✓ Success" : "✗ Failed"}`);
    });

    const anySuccess = results.clerk || Object.values(results.database).some((v) => v);
    if (anySuccess) {
      console.log("\x1b[32m%s\x1b[0m", "✓ User deletion completed with some operations successful");
    } else {
      console.log("\x1b[31m%s\x1b[0m", "✗ All operations failed");
      process.exit(1);
    }
  } catch (error) {
    console.error(
      "\x1b[31m%s\x1b[0m",
      "Error:",
      error instanceof Error ? error.message : "Unknown error occurred"
    );
    process.exit(1);
  }
}

yargs(hideBin(process.argv))
  .command(
    "$0 <user_id>",
    "Delete a user from Clerk and clean up database records",
    (yargs) =>
      yargs
        .positional("user_id", {
          describe: "The user ID to delete",
          type: "string",
        })
        .option("dev", devOption)
        .option("site", siteOption),
    async (argv) => {
      const site = argv.site as Site;
      const isDev = argv.dev;
      const keys = getClerkKeysFromEnv(isDev ? "dev" : "prod", site);

      if (!keys.secretKey) {
        console.error(
          `Error: Clerk secret key is required for ${site} (${isDev ? "dev" : "prod"})`
        );
        process.exit(1);
      }

      const clerk = createClerkClient({ secretKey: keys.secretKey });
      await deleteUser(assertString(argv.user_id), clerk);
    }
  )
  .help()
  .alias("help", "h")
  .strict()
  .demandCommand()
  .parse();
