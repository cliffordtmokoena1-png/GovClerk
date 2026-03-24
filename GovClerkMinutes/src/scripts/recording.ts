import { Command } from "commander";
import { connect } from "@planetscale/database";
import { completeUpload } from "@/pages/api/complete-upload";
import fs from "node:fs/promises";
import path from "node:path";
import { S3Client, GetObjectCommand, ListPartsCommand } from "@aws-sdk/client-s3";
import { assertString } from "@/utils/assert";
import { getTranscriptBucketNameByRegion, assertRegion, Region } from "@/utils/s3";

const conn = connect({
  host: process.env.PLANETSCALE_DB_HOST,
  username: process.env.PLANETSCALE_DB_USERNAME,
  password: process.env.PLANETSCALE_DB_PASSWORD,
});

type ChunkData = {
  parts?: Array<{
    partNumber?: number | string;
    PartNumber?: number | string;
    eTag?: string;
    ETag?: string;
  }>;
};

type RecordingMetadata = {
  region?: string;
  mimeType?: string;
  startTime?: number;
  totalSize?: number;
  [key: string]: unknown;
};

type RecordingSessionRow = {
  transcript_id: number;
  session_id: string;
  user_id: string;
  s3_key: string | null;
  s3_upload_id: string | null;
  chunk_data: ChunkData | string | null;
  metadata: RecordingMetadata | string | null;
  recording_state: string | null;
};

type RecordingParts = Array<{
  ETag: string;
  PartNumber: number;
}>;

type RecordingSession = {
  transcriptId: number;
  sessionId: string;
  userId: string;
  uploadId: string;
  s3Key?: string;
  state: string | null;
  metadata?: RecordingMetadata;
  parts: RecordingParts;
};

type CliOptions = {
  dryRun?: boolean;
  completeUpload?: boolean;
};

function parseJsonField<T>(value: T | string | null | undefined, fieldName: string): T | undefined {
  if (value == null) {
    return undefined;
  }

  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch (error) {
      throw new Error(`Failed to parse ${fieldName}: ${(error as Error).message}`);
    }
  }

  return value as T;
}

function normalizeParts(chunkData: ChunkData | undefined): RecordingParts {
  const rawParts = Array.isArray(chunkData?.parts) ? chunkData?.parts : [];

  const parts = rawParts
    .map((part, index) => {
      const rawNumber = part.partNumber ?? part.PartNumber;
      const numberValue = rawNumber == null ? Number.NaN : Number(rawNumber);
      const eTag = part.eTag ?? part.ETag;

      if (!Number.isFinite(numberValue)) {
        console.warn(`Skipping part at index ${index} due to invalid partNumber`, part);
        return undefined;
      }

      if (typeof eTag !== "string" || !eTag.length) {
        console.warn(`Skipping part at index ${index} due to missing eTag`, part);
        return undefined;
      }

      return {
        PartNumber: numberValue,
        ETag: eTag,
      };
    })
    .filter(Boolean) as RecordingParts;

  if (!parts.length) {
    throw new Error("No valid chunk parts found for this recording session");
  }

  return parts.sort((a, b) => a.PartNumber - b.PartNumber);
}

async function getRecordingSession(transcriptId: number): Promise<RecordingSession> {
  const result = await conn.execute(
    `SELECT transcript_id, session_id, user_id, s3_key, s3_upload_id, chunk_data, metadata, recording_state
     FROM recording_sessions
     WHERE transcript_id = ?
     LIMIT 1`,
    [transcriptId]
  );

  if (!result.rows.length) {
    throw new Error(`No recording session found for transcript ${transcriptId}`);
  }

  const row = result.rows[0] as RecordingSessionRow;
  const uploadId = row.s3_upload_id;

  if (!uploadId) {
    throw new Error(`Recording session ${row.session_id} is missing an s3_upload_id`);
  }

  const metadata = parseJsonField<RecordingMetadata>(row.metadata, "metadata");
  const chunkData = parseJsonField<ChunkData>(row.chunk_data, "chunk_data");
  const parts = normalizeParts(chunkData);

  return {
    transcriptId: row.transcript_id,
    sessionId: row.session_id,
    userId: row.user_id,
    uploadId,
    s3Key: row.s3_key ?? undefined,
    state: row.recording_state,
    metadata,
    parts,
  };
}

async function resolveStorageRegion(session: RecordingSession): Promise<Region> {
  if (session.metadata?.region) {
    return assertRegion(session.metadata.region);
  }

  const result = await conn.execute("SELECT aws_region FROM transcripts WHERE id = ?", [
    session.transcriptId,
  ]);

  const regionValue = result.rows[0]?.["aws_region"] as string | null | undefined;
  if (!regionValue) {
    throw new Error(`Unable to determine region for transcript ${session.transcriptId}`);
  }

  return assertRegion(regionValue);
}

async function downloadRecordingFile(session: RecordingSession): Promise<string> {
  const s3Key = session.s3Key;
  if (!s3Key) {
    throw new Error(`Recording session ${session.sessionId} missing s3_key`);
  }

  const region = await resolveStorageRegion(session);

  const s3 = new S3Client({
    credentials: {
      accessKeyId: assertString(process.env.AWS_ACCESS_KEY_ID),
      secretAccessKey: assertString(process.env.AWS_SECRET_ACCESS_KEY),
    },
    region,
  });

  const command = new GetObjectCommand({
    Bucket: getTranscriptBucketNameByRegion(region),
    Key: s3Key,
  });

  let bytes: Uint8Array | undefined;
  try {
    const response = await s3.send(command);
    bytes = await response.Body?.transformToByteArray();
  } catch (error) {
    console.error("Unable to download recording from S3:", error);
    throw new Error(
      "Failed to fetch the recording object. If the upload was never completed, rerun with --complete-upload."
    );
  }

  if (!bytes) {
    throw new Error("S3 object body was empty");
  }

  const dirName = `recording_${session.transcriptId}`;
  const dirPath = path.resolve(process.cwd(), dirName);
  await fs.mkdir(dirPath, { recursive: true });

  const filePath = path.join(dirPath, `${session.sessionId}.webm`);
  await fs.writeFile(filePath, Buffer.from(bytes));

  return filePath;
}

async function reconstructRecording(transcriptId: number, options: CliOptions): Promise<void> {
  const session = await getRecordingSession(transcriptId);

  console.log("Found recording session:");
  console.table([
    {
      transcriptId: session.transcriptId,
      sessionId: session.sessionId,
      userId: session.userId,
      s3Key: session.s3Key,
      state: session.state,
      uploadId: session.uploadId,
      region: session.metadata?.region ?? "unknown",
      totalSize: session.metadata?.totalSize,
      mimeType: session.metadata?.mimeType,
      parts: session.parts.length,
    },
  ]);

  if (options.dryRun) {
    console.log("Dry run enabled. Skipping S3 checks.");
    return;
  }

  const region = await resolveStorageRegion(session);
  const s3 = new S3Client({
    credentials: {
      accessKeyId: assertString(process.env.AWS_ACCESS_KEY_ID),
      secretAccessKey: assertString(process.env.AWS_SECRET_ACCESS_KEY),
    },
    region,
  });

  let isIncomplete = false;

  try {
    const command = new ListPartsCommand({
      Bucket: getTranscriptBucketNameByRegion(region),
      Key: session.s3Key!,
      UploadId: session.uploadId,
    });
    const response = await s3.send(command);
    console.log(JSON.stringify(response, null, 2));
    isIncomplete = true;
  } catch (error: any) {
    if (error.name !== "NoSuchUpload") {
      console.warn("Failed to check multipart upload status:", error);
    }
  }

  if (isIncomplete) {
    console.log("\n⚠️  Upload has not been completed.");

    if (options.completeUpload) {
      console.log("Completing upload...");
      await completeUpload({
        transcriptId: session.transcriptId,
        uploadId: session.uploadId,
        parts: session.parts,
        userId: session.userId,
        isRecording: true,
      });

      console.log(
        `✅ Completed multipart upload for transcript ${session.transcriptId} using session ${session.sessionId}.`
      );
    } else {
      console.log("Use --complete-upload to finish the upload.");
    }
    return;
  }

  if (options.completeUpload) {
    console.log("Upload is already completed (no active multipart upload found).");
    return;
  }

  const outputPath = await downloadRecordingFile(session);
  console.log(`🎧 Downloaded recording to ${outputPath}`);
}

const program = new Command()
  .name("recording")
  .description(
    "Inspect recorder sessions, download their webm audio, or complete the multipart upload"
  )
  .argument("<transcriptId>", "Transcript ID to reconstruct")
  .option("--dry-run", "Only fetch and log the session data")
  .option(
    "--complete-upload",
    "Complete the multipart upload on S3 and mark the recording as finished"
  )
  .action(async (transcriptIdArg: string, options: CliOptions) => {
    const transcriptId = Number(transcriptIdArg);
    if (!Number.isInteger(transcriptId) || transcriptId <= 0) {
      console.error("transcriptId must be a positive integer");
      process.exitCode = 1;
      return;
    }

    try {
      await reconstructRecording(transcriptId, options);
    } catch (error) {
      console.error("❌ Failed to reconstruct recording:", error);
      process.exitCode = 1;
    }
  });

program.parseAsync(process.argv).catch((error) => {
  console.error(error);
  process.exit(1);
});
