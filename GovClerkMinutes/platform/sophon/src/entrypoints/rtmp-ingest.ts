import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { getDb } from "../sqlite3/getDb.ts";

const streamKey = process.argv[2];

if (!streamKey) {
  console.error("Usage: node rtmp-ingest.js <streamKey>");
  process.exit(1);
}

console.info(`[rtmp-ingest] Starting ingest for key: ${streamKey}`);

const pgid = Number(
  execFileSync("bash", ["-lc", "ps -o pgid= -p " + process.pid])
    .toString()
    .trim()
);
console.info(`[rtmp-ingest] PID: ${process.pid}, PGID: ${pgid}`);

const db = getDb();
db.prepare("INSERT INTO rtmp_ingests (pid, stream_key) VALUES (?, ?)").run(pgid, streamKey);

const debugFilePath = path.join("/tmp", `ingest-${streamKey}-${Date.now()}.pcm`);
console.info(`[rtmp-ingest] Writing stream to ${debugFilePath}`);
const fileStream = fs.createWriteStream(debugFilePath);

const SOPHON_HOST = process.env.SOPHON_HOST || "localhost";
const SOPHON_PORT = process.env.SOPHON_PORT || "3000";
const AUDIO_CHUNK_SIZE = 4096;

let audioBuffer = Buffer.alloc(0);
let totalBytes = 0;
const logInterval = 1024 * 1024;
let nextLog = logInterval;

async function startTranscriptionSession(): Promise<boolean> {
  try {
    const response = await fetch(`http://${SOPHON_HOST}:${SOPHON_PORT}/transcribe/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ streamKey }),
    });
    if (response.ok) {
      console.info(`[rtmp-ingest] Transcription session started for ${streamKey}`);
      return true;
    }
    console.error(`[rtmp-ingest] Failed to start transcription: ${response.status}`);
    return false;
  } catch (err) {
    console.error("[rtmp-ingest] Error starting transcription session:", err);
    return false;
  }
}

async function sendAudioChunk(chunk: Buffer): Promise<void> {
  try {
    const body = chunk.buffer.slice(
      chunk.byteOffset,
      chunk.byteOffset + chunk.byteLength
    ) as ArrayBuffer;
    const response = await fetch(`http://${SOPHON_HOST}:${SOPHON_PORT}/transcribe/audio`, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "X-Stream-Key": streamKey,
      },
      body,
    });
    if (!response.ok) {
      console.error(`[rtmp-ingest] Failed to send audio chunk: ${response.status}`);
    }
  } catch (err) {
    console.error("[rtmp-ingest] Error sending audio chunk:", err);
  }
}

async function endTranscriptionSession(): Promise<void> {
  try {
    await fetch(`http://${SOPHON_HOST}:${SOPHON_PORT}/transcribe/end`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ streamKey }),
    });
    console.info(`[rtmp-ingest] Transcription session ended for ${streamKey}`);
  } catch (err) {
    console.error("[rtmp-ingest] Error ending transcription session:", err);
  }
}

async function processAudioBuffer(): Promise<void> {
  while (audioBuffer.length >= AUDIO_CHUNK_SIZE) {
    const chunk = audioBuffer.subarray(0, AUDIO_CHUNK_SIZE);
    audioBuffer = audioBuffer.subarray(AUDIO_CHUNK_SIZE);
    await sendAudioChunk(chunk);
  }
}

let transcriptionEnabled = false;
transcriptionEnabled = await startTranscriptionSession();

process.stdin.on("data", (chunk) => {
  totalBytes += chunk.length;
  fileStream.write(chunk);

  if (transcriptionEnabled) {
    audioBuffer = Buffer.concat([audioBuffer, chunk]);
    processAudioBuffer().catch((err) => {
      console.error("[rtmp-ingest] Error processing audio:", err);
    });
  }

  if (totalBytes > nextLog) {
    console.info(`[rtmp-ingest] Received ${totalBytes} bytes for ${streamKey}`);
    nextLog += logInterval;
  }
});

process.stdin.on("end", async () => {
  console.info(`[rtmp-ingest] Stream finished. Total bytes: ${totalBytes}`);
  fileStream.end();

  if (transcriptionEnabled && audioBuffer.length > 0) {
    await sendAudioChunk(audioBuffer);
  }

  await endTranscriptionSession();
});

process.stdin.on("error", async (err) => {
  console.error("[rtmp-ingest] Stream error:", err);
  fileStream.end();
  await endTranscriptionSession();
  process.exit(1);
});
