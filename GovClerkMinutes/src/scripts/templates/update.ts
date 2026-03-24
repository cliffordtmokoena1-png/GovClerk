import { assertString } from "@/utils/assert";
import { connect, Connection } from "@planetscale/database";
import dotenv from "dotenv";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import fs from "fs/promises";
import path from "path";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getTranscriptBucketNameByRegion, Region } from "@/utils/s3";
import { Transcript, Minute, Speaker, Segment, Change, TemplateData } from "@/templates/types";

dotenv.config({ path: ".env" });

async function getTemplateTranscriptData(
  transcriptId: number,
  conn: Connection
): Promise<Transcript | null> {
  try {
    const result = await conn.execute(
      `SELECT 
        id, userId, s3AudioKey, title, file_size, aws_region, upload_kind,
        transcribe_finished, transcribe_paused, transcribe_failed, credits_required, 
        client_corruption, deleted, preview_transcribe_finished, snippet
      FROM transcripts 
      WHERE id = ?`,
      [transcriptId]
    );

    if (result.rows.length === 0) {
      console.error(`No transcript found with ID: ${transcriptId}`);
      return null;
    }

    const row = result.rows[0] as any;
    const transcript: Transcript = {
      id: Number(row.id),
      userId: String(row.userId),
      s3AudioKey: String(row.s3AudioKey),
      title: String(row.title),
      file_size: Number(row.file_size),
      aws_region: String(row.aws_region),
      upload_kind: String(row.upload_kind),
      transcribe_finished: Number(row.transcribe_finished),
      transcribe_paused: Number(row.transcribe_paused),
      transcribe_failed: Number(row.transcribe_failed),
      credits_required: Number(row.credits_required),
      client_corruption: Number(row.client_corruption),
      deleted: Number(row.deleted),
      preview_transcribe_finished: Number(row.preview_transcribe_finished),
      snippet: row.snippet ? String(row.snippet) : null,
    };

    return transcript;
  } catch (error) {
    console.error("Error fetching transcript:", error);
    return null;
  }
}

async function getTemplateMinutes(transcriptId: number, conn: Connection): Promise<Minute[]> {
  try {
    const result = await conn.execute(
      `SELECT 
        transcript_id, user_id, minutes, rating, ms_word_clicks,
        copy_clicks, version, fast_mode
      FROM minutes 
      WHERE transcript_id = ?`,
      [transcriptId]
    );

    const minutes: Minute[] = (result.rows as any[]).map((row) => ({
      transcript_id: Number(row.transcript_id),
      user_id: String(row.user_id),
      minutes: String(row.minutes),
      rating: row.rating ? Number(row.rating) : null,
      ms_word_clicks: Number(row.ms_word_clicks),
      copy_clicks: Number(row.copy_clicks),
      version: Number(row.version),
      fast_mode: Number(row.fast_mode),
    }));

    return minutes;
  } catch (error) {
    console.error("Error fetching minutes:", error);
    return [];
  }
}

async function getTemplateSpeakers(transcriptId: number, conn: Connection): Promise<Speaker[]> {
  try {
    const result = await conn.execute(
      `SELECT 
        transcriptId, label, name, uses, userId,
        embedding, fast_mode, suggested_speakers, tags
      FROM speakers 
      WHERE transcriptId = ?`,
      [transcriptId]
    );

    const speakers: Speaker[] = [];

    for (const row of result.rows as any[]) {
      let embeddingArray: number[] | null = null;
      let suggestedSpeakers: any = null;
      let tags: string[] | null = null;

      if (row.embedding) {
        try {
          embeddingArray =
            typeof row.embedding === "string" ? JSON.parse(row.embedding) : row.embedding;
        } catch (e) {
          console.warn(`Could not parse embedding for speaker ${row.label}:`, e);
        }
      }

      if (row.suggested_speakers) {
        try {
          suggestedSpeakers =
            typeof row.suggested_speakers === "string"
              ? JSON.parse(row.suggested_speakers)
              : row.suggested_speakers;
        } catch (e) {
          console.warn(`Could not parse suggested_speakers for speaker ${row.label}:`, e);
        }
      }

      if (row.tags) {
        try {
          tags = typeof row.tags === "string" ? JSON.parse(row.tags) : row.tags;
        } catch (e) {
          console.warn(`Could not parse tags for speaker ${row.label}:`, e);
        }
      }

      const speaker: Speaker = {
        transcriptId: Number(row.transcriptId),
        label: String(row.label),
        name: String(row.name),
        uses: Number(row.uses),
        userId: String(row.userId),
        embedding: embeddingArray,
        fast_mode: Number(row.fast_mode),
        suggested_speakers: [],
        tags: ["example"],
      };

      speakers.push(speaker);
    }

    return speakers;
  } catch (error) {
    console.error("Error fetching speakers:", error);
    return [];
  }
}

async function getTemplateSegments(transcriptId: number, conn: Connection): Promise<Segment[]> {
  try {
    const result = await conn.execute(
      `SELECT 
        transcript_id, start, stop, speaker, transcript,
        segment_index, fast_mode, is_user_visible
      FROM gc_segments 
      WHERE transcript_id = ?`,
      [transcriptId]
    );

    const segments: Segment[] = (result.rows as any[]).map((row) => ({
      transcript_id: Number(row.transcript_id),
      start: row.start,
      stop: row.stop,
      speaker: String(row.speaker),
      transcript: row.transcript ? String(row.transcript) : null,
      segment_index: Number(row.segment_index),
      fast_mode: Number(row.fast_mode),
      is_user_visible: Number(row.is_user_visible),
    }));

    return segments;
  } catch (error) {
    console.error("Error fetching segments:", error);
    return [];
  }
}

async function getTemplateChanges(transcriptId: number, conn: Connection): Promise<Change[]> {
  try {
    const result = await conn.execute(
      `SELECT 
        transcript_id, revision_id, user_id, change_type,
        diff_content, base_version, new_version, fast_mode
      FROM changes 
      WHERE transcript_id = ?`,
      [transcriptId]
    );

    const changes: Change[] = (result.rows as any[]).map((row) => ({
      transcript_id: Number(row.transcript_id),
      revision_id: String(row.revision_id),
      user_id: String(row.user_id),
      change_type: String(row.change_type),
      diff_content: String(row.diff_content),
      base_version: Number(row.base_version),
      new_version: Number(row.new_version),
      fast_mode: Number(row.fast_mode),
    }));

    return changes;
  } catch (error) {
    console.error("Error fetching changes:", error);
    return [];
  }
}

async function ensureTemplateDirectories(): Promise<void> {
  const templateDirs = [path.resolve(process.cwd(), "src/templates/example-minutes")];

  for (const dir of templateDirs) {
    try {
      await fs.access(dir);
    } catch (error) {
      console.log(`Creating template directory: ${dir}`);
      await fs.mkdir(dir, { recursive: true });
    }
  }
}

async function writeTemplateFiles(templateData: TemplateData): Promise<void> {
  try {
    const baseDir = path.resolve(process.cwd(), "src/templates/example-minutes");

    const files = [
      {
        name: "transcripts.ts",
        content: `export const transcripts = ${JSON.stringify(templateData.transcripts, null, 2)};`,
      },
      {
        name: "minutes.ts",
        content: `export const minutes = ${JSON.stringify(templateData.minutes, null, 2)};`,
      },
      {
        name: "speakers.ts",
        content: `export const speakers = ${JSON.stringify(templateData.speakers, null, 2)};`,
      },
      {
        name: "gc_segments.ts",
        content: `export const gc_segments = ${JSON.stringify(templateData.gc_segments, null, 2)};`,
      },
      {
        name: "changes.ts",
        content: `export const changes = ${JSON.stringify(templateData.changes, null, 2)};`,
      },
    ];

    for (const file of files) {
      const filePath = path.join(baseDir, file.name);
      await fs.writeFile(filePath, file.content);
      console.log(`✅ Wrote ${filePath}`);
    }

    console.log(`✅ Template data successfully created from transcript`);
  } catch (error) {
    console.error("Error writing template files:", error);
  }
}

async function updateTemplate(transcriptId: number): Promise<void> {
  try {
    console.log(`🔍 Fetching transcript with ID: ${transcriptId} to update template...`);

    const conn = connect({
      host: process.env.PLANETSCALE_DB_HOST,
      username: process.env.PLANETSCALE_DB_USERNAME,
      password: process.env.PLANETSCALE_DB_PASSWORD,
    });

    const transcript = await getTemplateTranscriptData(transcriptId, conn);

    if (!transcript) {
      console.error(`❌ Failed to fetch transcript with ID: ${transcriptId}`);
      return;
    }

    const minutes = await getTemplateMinutes(transcriptId, conn);
    const speakers = await getTemplateSpeakers(transcriptId, conn);
    const segments = await getTemplateSegments(transcriptId, conn);
    const changes = await getTemplateChanges(transcriptId, conn);

    const templateData: TemplateData = {
      transcripts: [transcript],
      minutes: minutes,
      speakers: speakers,
      gc_segments: segments,
      changes: changes,
    };

    await ensureTemplateDirectories();
    await writeTemplateFiles(templateData);

    console.log(`✅ Successfully updated template from transcript ID: ${transcriptId}`);
  } catch (error) {
    console.error("Error updating template:", error);
  }
}

yargs(hideBin(process.argv))
  .command(
    "* <transcript_id>",
    "Update the template from an existing transcript",
    (yargs) =>
      yargs.positional("transcript_id", {
        describe: "The ID of the transcript to use as a template",
        type: "number",
        demandOption: true,
      }),
    async (argv) => {
      await updateTemplate(argv.transcript_id);
    }
  )
  .help()
  .alias("help", "h").argv;
