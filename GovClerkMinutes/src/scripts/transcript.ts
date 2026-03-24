import { assertString } from "@/utils/assert";
import { connect, Connection } from "@planetscale/database";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import fs from "fs/promises";
import path from "path";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getTranscriptBucketNameByRegion, Region } from "@/utils/s3";
import { downloadTranscript } from "@/scripts/utils/transcript";
import { fileTypeFromBuffer } from "file-type";
import { execFile } from "child_process";
import { promisify } from "util";
import ffmpegPath from "ffmpeg-static";
import { convertDocument } from "./utils/pandoc";
import { getSpeakerMap, substituteSpeakerLabels } from "@/utils/speakers";

const execFileAsync = promisify(execFile);

export async function getWebmDuration(filePath: string): Promise<number | null> {
  if (!ffmpegPath) throw new Error("Missing ffmpeg binary path");

  try {
    const { stderr } = await execFileAsync(
      ffmpegPath,
      [
        "-hide_banner", // hides startup junk
        "-nostdin", // don't wait for 'q'
        "-i",
        filePath,
        "-f",
        "null",
        "/dev/null",
      ],
      {
        maxBuffer: 1024 * 1024 * 10, // increase buffer
      }
    );

    // Match the **last** occurrence of time=HH:MM:SS.ss
    const matches = [...stderr.matchAll(/time=(\d+):(\d+):(\d+\.\d+)/g)];
    if (matches.length === 0) return null;

    const lastMatch = matches[matches.length - 1];
    const [, hours, minutes, seconds] = lastMatch;
    const duration = parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseFloat(seconds);

    return duration;
  } catch (err) {
    console.error("❌ ffmpeg failed:", err);
    return null;
  }
}

async function fixWebmFileDuration(bytes: Uint8Array, filePath: string): Promise<Uint8Array> {
  if (!ffmpegPath) throw new Error("Missing ffmpeg binary path");

  // ── 1. materialise original bytes ───────────────────────────────────────────
  const src = `/tmp/in_${Date.now()}.webm`;
  const dst = `/tmp/out_${Date.now()}.webm`;
  await fs.writeFile(src, bytes);

  // ── 2. fast re-mux; this writes Segment-Info Duration ──────────────────────
  //     -c copy   : copy audio & (if any) video bit-exactly (no re-encode)
  //     -map 0    : keep every stream
  await execFileAsync(
    ffmpegPath,
    [
      "-hide_banner",
      "-nostdin",
      "-i",
      src,
      "-c",
      "copy",
      "-map",
      "0",
      "-f",
      "webm",
      "-y", // overwrite if dst exists
      dst,
    ],
    { maxBuffer: 1024 * 1024 * 2 } // 2 MiB is plenty for stderr
  );

  // ── 3. read the fixed file back ────────────────────────────────────────────
  const fixed = await fs.readFile(dst);

  console.log(`✅ ffmpeg re-mux wrote proper duration for ${path.basename(filePath)}`);

  // ── 4. tidy up ─────────────────────────────────────────────────────────────
  await Promise.allSettled([fs.unlink(src), fs.unlink(dst)]);

  return new Uint8Array(fixed);
}

async function setupOutputDir(transcriptId: number): Promise<string> {
  const dirName = `gc_transcript_${transcriptId}`;
  await fs.mkdir(dirName);
  return dirName;
}

async function downloadMinutes(
  transcriptId: number,
  outputDir: string,
  conn: Connection
): Promise<void> {
  const rows = await conn
    .execute("SELECT * FROM minutes WHERE transcript_id = ?;", [transcriptId])
    .then((result) => result.rows);

  if (rows.length === 0) {
    console.log("🟨 No minutes");
    return;
  }

  // Get transcript info to get user ID
  const transcriptRecord = await conn
    .execute("SELECT userId FROM transcripts WHERE id = ?;", [transcriptId])
    .then((res) => res.rows[0]);

  const userId = assertString(transcriptRecord["userId"]);

  const speakerMap = await getSpeakerMap(transcriptId);

  for (const row of rows) {
    const fastMode = row["fast_mode"] === 1;
    const minutesDocxPath = path.join(
      outputDir,
      `minutes-${fastMode ? "fast-" : ""}v${row["version"]}.docx`
    );

    const minutesContent = substituteSpeakerLabels(row["minutes"], speakerMap);

    if (!minutesContent) {
      console.log(`🟨 No minutes content for version ${row["version"]}`);
      continue;
    }

    const minutesMdPath = path.join(outputDir, `minutes-v${row["version"]}.md`);
    await fs.writeFile(minutesMdPath, minutesContent);
    console.log(`✅ Downloaded ${minutesMdPath}`);

    const docxBlob = await convertDocument({
      input: new Blob([minutesContent], { type: "text/markdown" }),
      inputType: "gfm",
      outputType: "docx",
    });

    const docxBuffer = Buffer.from(await docxBlob.arrayBuffer());
    await fs.writeFile(minutesDocxPath, docxBuffer);

    console.log(`✅ Downloaded ${minutesDocxPath}`);
  }

  const minutesCsv = path.join(outputDir, "minutes.csv");
  const csvHeader = Object.keys(rows[0])
    .filter((col) => col !== "minutes")
    .join(",");
  await fs.writeFile(
    minutesCsv,
    csvHeader +
      "\n" +
      rows
        .map((row) =>
          Object.entries(row)
            .filter(([col, _]) => col !== "minutes")
            .map(([_, val]) => val)
            .join(",")
        )
        .join("\n")
  );

  console.log(`✅ Wrote ${minutesCsv}`);
}

async function downloadUploadedFile(
  transcriptId: number,
  outputDir: string,
  conn: Connection,
  s3: S3Client,
  region: Region
): Promise<void> {
  const record = await conn
    .execute("SELECT s3AudioKey FROM transcripts WHERE id = ?;", [transcriptId])
    .then((res) => {
      return res.rows[0];
    });

  const s3AudioKey = assertString(record["s3AudioKey"]);

  const command = new GetObjectCommand({
    Bucket: getTranscriptBucketNameByRegion(region),
    Key: s3AudioKey,
  });

  const response = await s3.send(command);
  const bytes = await response.Body?.transformToByteArray();
  if (bytes == null) {
    console.error(`Failed to download ${s3AudioKey}`);
    return;
  }

  // Detect file type from bytes
  const fileType = await fileTypeFromBuffer(bytes);
  const baseFileName = path.basename(s3AudioKey);

  // Add extension if file type is detected, otherwise use original name
  const fileName = fileType ? `${baseFileName}.${fileType.ext}` : baseFileName;
  const recordingPath = path.join(outputDir, fileName);

  // Check if this is a .webm file and fix duration if needed
  let finalBytes = bytes;
  if (fileType?.ext === "webm") {
    finalBytes = await fixWebmFileDuration(bytes, recordingPath);
  }

  await fs.writeFile(recordingPath, finalBytes);

  console.log(`✅ Downloaded ${recordingPath}`);
}

async function downloadOutlineAndFeedback(
  transcriptId: number,
  outputDir: string,
  conn: Connection
): Promise<void> {
  const rows = await conn
    .execute(
      "SELECT version, outline, first_draft, oracle_feedback FROM minutes WHERE transcript_id = ?;",
      [transcriptId]
    )
    .then((result) => result.rows);

  if (rows.length === 0) {
    console.log("🟨 No minutes with outline or oracle_feedback");
    return;
  }

  for (const row of rows as any[]) {
    const version = row["version"];
    const outline = row["outline"];
    const firstDraft = row["first_draft"];
    const oracleFeedback = row["oracle_feedback"];

    if (outline) {
      const outlinePath = path.join(outputDir, `outline-v${version}.md`);
      await fs.writeFile(outlinePath, outline);
      console.log(`✅ Downloaded ${outlinePath}`);
    }

    if (firstDraft) {
      const firstDraftPath = path.join(outputDir, `first_draft-v${version}.md`);
      await fs.writeFile(firstDraftPath, firstDraft);
      console.log(`✅ Downloaded ${firstDraftPath}`);
    }

    if (oracleFeedback) {
      const feedbackPath = path.join(outputDir, `oracle_feedback-v${version}.md`);
      await fs.writeFile(feedbackPath, oracleFeedback);
      console.log(`✅ Downloaded ${feedbackPath}`);
    }
  }
}

yargs(hideBin(process.argv))
  .command(
    "* <transcript_id>",
    "Download relevant files for a given transcript",
    (yargs) =>
      yargs.positional("transcript_id", {
        describe: "The ID of the transcript to download",
        type: "number",
        demandOption: true,
      }),
    async (argv) => {
      const outputDir = await setupOutputDir(argv.transcript_id);

      const conn = connect({
        host: process.env.PLANETSCALE_DB_HOST,
        username: process.env.PLANETSCALE_DB_USERNAME,
        password: process.env.PLANETSCALE_DB_PASSWORD,
      });

      const record = await conn
        .execute("SELECT aws_region FROM transcripts WHERE id = ?;", [argv.transcript_id])
        .then((res) => {
          return res.rows[0];
        });

      const region = record["aws_region"] as Region;

      const s3 = new S3Client({
        credentials: {
          accessKeyId: assertString(process.env.AWS_ACCESS_KEY_ID),
          secretAccessKey: assertString(process.env.AWS_SECRET_ACCESS_KEY),
        },
        region,
      });

      const handleTaskErr = (err: any) => {
        console.error(err);
      };

      await Promise.all([
        downloadUploadedFile(argv.transcript_id, outputDir, conn, s3, region).catch(handleTaskErr),
        downloadMinutes(argv.transcript_id, outputDir, conn).catch(handleTaskErr),
        downloadTranscript(argv.transcript_id, outputDir).catch(handleTaskErr),
        downloadOutlineAndFeedback(argv.transcript_id, outputDir, conn).catch(handleTaskErr),
      ]);
    }
  )
  .help()
  .alias("help", "h").argv;
