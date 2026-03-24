import dotenv from "dotenv";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { insertTemplateTranscript } from "@/templates/templates";

dotenv.config({ path: ".env" });

async function insertTemplate({ userId }: { userId: string }): Promise<void> {
  try {
    console.log(`🔄 Inserting template transcript for user: ${userId}`);

    const transcriptId = await insertTemplateTranscript(userId);

    if (transcriptId) {
      console.log(
        `✅ Successfully inserted template transcript with ID: ${transcriptId} for user: ${userId}`
      );
    } else {
      console.error(`❌ Failed to insert template transcript for user: ${userId}`);
    }
  } catch (error) {
    console.error("Error inserting template:", error);
  }
}

yargs(hideBin(process.argv))
  .command(
    "* <user_id>",
    "Insert a template transcript for the specified user",
    (yargs) =>
      yargs.positional("user_id", {
        describe: "The ID of the user to insert the template for",
        type: "string",
        demandOption: true,
      }),
    async (argv) => {
      await insertTemplate({ userId: argv.user_id });
    }
  )
  .help()
  .alias("help", "h").argv;
