import { connect } from "@planetscale/database";
import dotenv from "dotenv";
import Table from "cli-table3";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import path from "path";
import { createPatch } from "diff";
import fs from "fs/promises";
import { convertDocument } from "./utils/pandoc";

dotenv.config({ path: ".env" });

type MinutesRecord = {
  id: number;
  transcript_id: number;
  user_id: string;
  minutes: string;
  rating: string | null;
  ms_word_clicks: number;
  copy_clicks: number;
  ts_start: string;
  version: number;
};

type ChangesRecord = {
  id: number;
  transcript_id: number;
  user_id: string;
  fast_mode: number;
  change_type: string;
  revision_id: number;
  created_at: string;
};

// No newText used here, because the forward diff array is enough.
function reconstructOldFromForwardDiff(diffArray: any[]): string {
  let oldText = "";
  for (const chunk of diffArray) {
    // If chunk was removed or unchanged in the forward diff,
    // it existed in oldText
    if (chunk.removed || (!chunk.added && !chunk.removed)) {
      oldText += chunk.value;
    }
    // If chunk.added == true, that text was never in oldText,
    // so we skip it.
  }
  return oldText;
}

async function calculateDiff(transcriptId: number, revisionId: number, fastMode: number) {
  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  // Retrieve all diffs for the given transcript_id and revision_id
  const diffs = await conn
    .execute(
      `
      SELECT diff_content
      FROM changes
      WHERE transcript_id = ? AND revision_id = ? AND fast_mode = ?
      ORDER BY created_at ASC
      `,
      [transcriptId, revisionId, fastMode]
    )
    .then((result) => result.rows.map((row) => row["diff_content"]));

  if (diffs.length === 0) {
    console.log("No diffs found for transcript_id", transcriptId, "revision_id", revisionId);
    return;
  }

  let minutes: string | undefined = await conn
    .execute(
      `
      SELECT minutes
      FROM minutes
      WHERE transcript_id = ? AND version = ? AND fast_mode = ?
      `,
      [transcriptId, revisionId, fastMode]
    )
    .then((result) => result.rows[0]?.["minutes"]);

  if (!minutes) {
    throw new Error(
      `Minutes not found for transcript_id ${transcriptId} and version ${revisionId}`
    );
  }

  minutes = minutes.replaceAll("- ", "* ");

  let updatedMinutes = reconstructOldFromForwardDiff(JSON.parse(diffs[0]));
  updatedMinutes = updatedMinutes.replaceAll("- ", "* ");

  const unifiedDiff = createPatch("minutes", updatedMinutes, minutes);

  console.log(unifiedDiff);
}

function logChanges(changes: ChangesRecord[]): void {
  const table = new Table({
    head: [
      "id",
      "transcript_id",
      "user_id",
      "fast_mode",
      "change_type",
      "revision_id",
      "created_at",
    ],
    colWidths: [10, 15, 35, 15, 20, 20, 20],
  });

  for (const c of changes) {
    table.push([
      c.id,
      c.transcript_id,
      c.user_id,
      c.fast_mode,
      c.change_type,
      c.revision_id,
      c.created_at,
    ]);
  }

  console.log(table.toString());
}

function logMinutes(minutes: MinutesRecord[]): void {
  const table = new Table({
    head: [
      "id",
      "transcript_id",
      "user_id",
      "rating",
      "ms_word_clicks",
      "copy_clicks",
      "ts_start",
      "version",
    ],
    colWidths: [10, 15, 35, 10, 20, 15, 25, 10],
  });

  for (const m of minutes) {
    table.push([
      m.id,
      m.transcript_id,
      m.user_id,
      m.rating,
      m.ms_word_clicks,
      m.copy_clicks,
      m.ts_start,
      m.version,
    ]);
  }

  console.log(table.toString());
}

async function getChanges(days: number): Promise<ChangesRecord[]> {
  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  const rows = await conn
    .execute(
      `
      SELECT id, transcript_id, user_id, fast_mode, change_type, revision_id, created_at
      FROM changes
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      ORDER BY created_at DESC;
      `,
      [days]
    )
    .then((result) => result.rows);

  return rows as any;
}

async function getMinutes(days: number): Promise<MinutesRecord[]> {
  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  const rows = await conn
    .execute(
      "SELECT id, transcript_id, user_id, minutes, rating, ms_word_clicks, copy_clicks, ts_start, version FROM minutes WHERE ts_start >= DATE_SUB(NOW(), INTERVAL ? DAY) ORDER BY ts_start DESC;",
      [days]
    )
    .then((result) => result.rows);

  return rows as any;
}

async function exportMinutes(id: number): Promise<void> {
  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  const [rows] = await conn
    .execute("SELECT minutes FROM minutes WHERE id = ?;", [id])
    .then((result) => result.rows);

  if (rows == null) {
    console.error(`No minutes found for ID ${id}`);
    return;
  }

  const minutes = rows["minutes"];

  const filePath = path.join("/tmp", `minutes-${id}.docx`);
  const docxBlob = await convertDocument({
    input: new Blob([minutes], { type: "text/markdown" }),
    inputType: "gfm",
    outputType: "docx",
  });

  const buffer = Buffer.from(await docxBlob.arrayBuffer());
  await fs.writeFile(filePath, buffer);

  console.log(`Exported minutes to ${filePath}`);
}

async function main() {
  yargs(hideBin(process.argv))
    .command(
      "list",
      "List minutes from the past N days",
      (yargs) => {
        return yargs.option("days", {
          alias: "d",
          type: "number",
          description: "Number of days to fetch data for",
          default: 1,
        });
      },
      async (argv) => {
        const rows = await getMinutes(argv.days as number);
        logMinutes(rows);
      }
    )
    .command(
      "list-changes",
      "List minutes that were edited from the past N days",
      (yargs) => {
        return yargs.option("days", {
          alias: "d",
          type: "number",
          description: "Number of days to fetch data for",
          default: 1,
        });
      },
      async (argv) => {
        const changes = await getChanges(argv.days as number);
        logChanges(changes);
      }
    )
    .command(
      "diff <transcript_id> <revision_id> [<fast_mode>]",
      "Diff minutes by transcript_id and revision_id",
      (yargs) => {
        return yargs
          .positional("transcript_id", {
            type: "number",
            description: "transcript_id",
            requiresArg: true,
            demandOption: true,
          })
          .positional("revision_id", {
            type: "number",
            description: "revision_id",
            requiresArg: true,
            demandOption: true,
          })
          .positional("fast_mode", {
            type: "number",
            description: "fast_mode",
            requiresArg: false,
            demandOption: true,
            default: 0,
          });
      },
      async (argv) => {
        const { transcript_id, revision_id, fast_mode } = argv;
        await calculateDiff(transcript_id as number, revision_id as number, fast_mode as number);
      }
    )
    .command(
      "export <id>",
      "Export minutes by ID to a Word document",
      (yargs) => {
        return yargs.positional("id", {
          describe: "ID of the minutes to export",
          type: "number",
        });
      },
      async (argv) => {
        exportMinutes(argv.id as number);
      }
    )
    .help()
    .alias("help", "h")
    .demandCommand(1, "You need at least one command before moving on")
    .strict()
    .parse();
}

main();
