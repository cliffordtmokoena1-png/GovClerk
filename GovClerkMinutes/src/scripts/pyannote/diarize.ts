import * as fs from "fs";
import * as path from "path";

import { PostHog } from "posthog-node";
import { connect, Connection } from "@planetscale/database";
import chalk from "chalk";
import { S3Client, HeadObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { HeadObjectCommandOutput } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const log = {
  step: (message: string) => console.log(`${chalk.cyan.bold(message)}`),
  info: (message: string) => console.log(`${message}`),
  success: (message: string) => console.log(`${chalk.green("✓")} ${message}`),
  warn: (message: string) => console.log(`${chalk.yellow("⚠")} ${message}`),
  error: (message: string) => console.error(`${chalk.red("✗")} ${message}`),
  result: (message: string) => console.log(`${message}`),
  data: (key: string, value: any) => console.log(`${key}=${value}`),
};

interface DiarizationSegment {
  speaker: string;
  start: number;
  end: number;
}

interface PyannoteJobResponse {
  jobId: string;
  status: "pending" | "running" | "succeeded" | "failed" | "canceled";
  output?: {
    diarization: DiarizationSegment[];
  };
}

interface ProcessedSegment {
  speaker: string;
  start: string;
  stop: string;
}

interface DiarizationOutput {
  segments: ProcessedSegment[];
  speakers: {
    count: number;
    labels: string[];
    embeddings: Record<string, number[]>;
  };
}

interface DiarizationMetrics {
  startTime: number;
  endTime: number;
  durationMs: number;
  segmentCount: number;
  speakerCount: number;
  transcriptId: string;
}

const PYANNOTE_API_KEY = process.env.PYANNOTE_API_KEY;
const POSTHOG_API_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST;
const BASE_OUTPUT_DIR = path.resolve(__dirname, "../../pyannote-results");

if (!fs.existsSync(BASE_OUTPUT_DIR)) {
  fs.mkdirSync(BASE_OUTPUT_DIR, { recursive: true });
}

let posthogClient: PostHog | null = null;
if (POSTHOG_API_KEY) {
  posthogClient = new PostHog(POSTHOG_API_KEY, {
    host: POSTHOG_HOST,
    flushAt: 1,
    flushInterval: 0,
  });
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Please provide a transcript ID");
  process.exit(1);
}

const transcriptId = args[0];

interface S3Details {
  key: string;
  bucket: string;
  region: string;
}

function getUploadKey(transcriptId: number): string {
  const testPrefix = "";
  return `${testPrefix}uploads/upload_${transcriptId}`;
}

function createDbConnection(): Connection {
  return connect({
    host: process.env.PLANETSCALE_DB_HOST || "",
    username: process.env.PLANETSCALE_DB_USERNAME || "",
    password: process.env.PLANETSCALE_DB_PASSWORD || "",
  });
}

async function getOriginalDiarization(transcriptId: number): Promise<DiarizationOutput> {
  const conn = createDbConnection();

  try {
    const result = await conn.execute(
      "SELECT start, stop, speaker, transcript, segment_index FROM gc_segments WHERE transcript_id = ? ORDER BY CAST(start AS TIME);",
      [transcriptId]
    );

    if (!result.rows || result.rows.length === 0) {
      throw new Error(`No segments found for transcript ID ${transcriptId}`);
    }

    const segments: ProcessedSegment[] = [];
    const speakerSet = new Set<string>();

    for (const row of result.rows) {
      const speaker = row.speaker as string;
      const start = row.start as string;
      const stop = row.stop as string;

      speakerSet.add(speaker);

      segments.push({
        speaker,
        start,
        stop,
      });
    }

    const speakerLabels = Array.from(speakerSet);
    const embeddings: Record<string, number[]> = {};

    speakerLabels.forEach((speaker) => {
      embeddings[speaker] = Array(10).fill(0);
    });

    return {
      segments,
      speakers: {
        count: speakerLabels.length,
        labels: speakerLabels,
        embeddings,
      },
    };
  } catch (error: any) {
    log.error(`Failed to retrieve original diarization: ${error.message}`);
    throw error;
  }
}

function saveOriginalDiarization(results: DiarizationOutput, outputDir: string): string {
  const outputPath = path.join(outputDir, "original_diarization.json");
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  return outputPath;
}

async function getS3DetailsFromDatabase(): Promise<S3Details> {
  const maxRetries = 3;
  let retryCount = 0;
  let lastError;

  while (retryCount < maxRetries) {
    try {
      const conn = createDbConnection();
      const result = await conn.execute(
        "SELECT s3AudioKey, aws_region FROM transcripts WHERE id = ?",
        [transcriptId]
      );

      if (!result.rows || result.rows.length === 0) {
        throw new Error(`No transcript found with ID ${transcriptId}`);
      }

      const row = result.rows[0] as any;
      const awsRegion = row.aws_region || "us-east-2";

      let s3AudioKey = row.s3AudioKey;
      if (!s3AudioKey) {
        s3AudioKey = getUploadKey(parseInt(transcriptId, 10));
      }

      let bucket: string;
      if (awsRegion === "us-east-2") {
        bucket = "govclerk-audio-uploads";
      } else if (awsRegion === "eu-central-1") {
        bucket = "GovClerkMinutesfrankfurt";
      } else {
        bucket = "govclerk-audio-uploads";
      }

      return {
        key: s3AudioKey,
        bucket: bucket,
        region: awsRegion,
      };
    } catch (error: any) {
      lastError = error;
      if (retryCount < maxRetries - 1) {
        retryCount++;
        const waitTime = Math.pow(2, retryCount) * 1000;
        log.warn(`Database connection failed. Retrying in ${waitTime / 1000}s...`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        continue;
      } else {
        throw error;
      }
    }
  }
  throw lastError;
}

async function verifyS3ObjectExists(
  s3Details: S3Details
): Promise<{ exists: boolean; contentType?: string; size?: number }> {
  const s3 = new S3Client({
    region: s3Details.region,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    },
  });

  const command = new HeadObjectCommand({
    Bucket: s3Details.bucket,
    Key: s3Details.key,
  });

  try {
    const response = (await s3.send(command)) as HeadObjectCommandOutput;
    log.success(`Found S3 audio file (${formatBytes(response.ContentLength || 0)})`);
    return {
      exists: true,
      contentType: response.ContentType,
      size: response.ContentLength,
    };
  } catch (headError: any) {
    if (headError.name === "NotFound" || headError.$metadata?.httpStatusCode === 404) {
      log.error(`S3 object not found: ${s3Details.key}`);
      return { exists: false };
    }
    throw new Error(`Cannot access S3 object: ${headError.message}`);
  }
}

function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + " " + sizes[i];
}

async function generatePresignedUrl(s3Details: S3Details): Promise<string> {
  const s3 = new S3Client({
    region: s3Details.region,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    },
  });

  const command = new GetObjectCommand({
    Bucket: s3Details.bucket,
    Key: s3Details.key,
  });

  return await getSignedUrl(s3 as any, command as any, { expiresIn: 3600 });
}

async function callPyannoteApi(audioUrl: string): Promise<PyannoteJobResponse> {
  log.info("Calling PyAnnote API with audio URL...");

  if (!PYANNOTE_API_KEY) throw new Error("PyAnnote API key is missing.");

  try {
    const verifyResponse = await fetch(audioUrl, { method: "HEAD" });
    const contentType = verifyResponse.headers.get("content-type");
    if (contentType?.includes("xml")) {
      log.warn("WARNING: URL is returning XML instead of audio.");
    }
  } catch (e) {
    log.warn("Audio URL check failed, proceeding anyway.");
  }

  const response = await fetch("https://api.pyannote.ai/v1/diarize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PYANNOTE_API_KEY}`,
      "Content-Type": "application/json",
      "User-Agent": "Minutes-Generator-Diarization/1.0",
    },
    body: JSON.stringify({ url: audioUrl }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`API failed (${response.status}): ${JSON.stringify(errorData)}`);
  }

  return (await response.json()) as PyannoteJobResponse;
}

async function pollJobStatus(jobId: string): Promise<PyannoteJobResponse> {
  log.step(`Polling job status ${chalk.bold(jobId)}`);

  let attempts = 0;
  const maxAttempts = 120;
  let backoffMs = 5000;

  while (attempts < maxAttempts) {
    try {
      const response = await fetch(`https://api.pyannote.ai/v1/jobs/${jobId}`, {
        headers: { Authorization: `Bearer ${PYANNOTE_API_KEY}` },
      });

      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get("retry-after") || "60");
        await new Promise((r) => setTimeout(r, retryAfter * 1000));
        continue;
      }

      if (!response.ok) throw new Error(`Poll failed: ${response.status}`);

      const data = (await response.json()) as PyannoteJobResponse;
      log.info(`Job status: ${chalk.bold(data.status)}`);

      if (data.status === "succeeded") return data;
      if (data.status === "failed" || data.status === "canceled") {
        throw new Error(`Job ${data.status}`);
      }

      await new Promise((r) => setTimeout(r, backoffMs));
      backoffMs = Math.min(backoffMs * 1.2, 60000);
      attempts++;
    } catch (error: any) {
      log.error(`Poll error: ${error.message}`);
      await new Promise((r) => setTimeout(r, backoffMs));
      attempts++;
    }
  }
  throw new Error("Polling timed out");
}

function processDiarizationResults(results: PyannoteJobResponse): DiarizationOutput {
  const segments = results.output?.diarization || [];
  const uniqueSpeakers = new Set(segments.map(s => s.speaker));
  const speakerLabels = Array.from(uniqueSpeakers);

  const embeddings: Record<string, number[]> = {};
  speakerLabels.forEach(s => embeddings[s.replace("SPEAKER_", "")] = Array(10).fill(0));

  return {
    segments: segments.map(s => ({
      speaker: s.speaker.replace("SPEAKER_", ""),
      start: s.start.toString(),
      stop: s.end.toString(),
    })),
    speakers: {
      count: speakerLabels.length,
      labels: speakerLabels.map(l => l.replace("SPEAKER_", "")),
      embeddings,
    },
  };
}

function createOutputDir(transcriptId: string): string {
  const outputDir = path.join(BASE_OUTPUT_DIR, `${transcriptId}_pyannote`);
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  return outputDir;
}

async function trackDiarizationEvent(metrics: DiarizationMetrics): Promise<void> {
  if (!posthogClient) return;
  try {
    posthogClient.capture({
      distinctId: `transcript:${metrics.transcriptId}`,
      event: "pyannote_diarization_completed",
      properties: { ...metrics, source: "pyannote-diarize-script" },
    });
    await posthogClient.shutdown();
  } catch (error) {}
}

async function main(): Promise<void> {
  const startTime = Date.now();
  let s3Details: S3Details = { key: "", bucket: "", region: "" };

  try {
    log.step(`Diarizing transcript ${transcriptId}`);
    const outputDir = createOutputDir(transcriptId);

    try {
      const original = await getOriginalDiarization(Number(transcriptId));
      fs.writeFileSync(path.join(outputDir, "original_diarization.json"), JSON.stringify(original, null, 2));
    } catch (e) {}

    s3Details = await getS3DetailsFromDatabase();
    const presignedUrl = await generatePresignedUrl(s3Details);
    
    const apiResponse = await callPyannoteApi(presignedUrl);
    const jobResults = await pollJobStatus(apiResponse.jobId);
    const processedResults = processDiarizationResults(jobResults);

    fs.writeFileSync(path.join(outputDir, "pyannote_processed.json"), JSON.stringify(processedResults, null, 2));
    log.success("Diarization complete");

    await trackDiarizationEvent({
      startTime,
      endTime: Date.now(),
      durationMs: Date.now() - startTime,
      segmentCount: processedResults.segments.length,
      speakerCount: processedResults.speakers.count,
      transcriptId,
    });
  } catch (error: any) {
    log.error(error.message);
    process.exit(1);
  }
}

main();