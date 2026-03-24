import { spawn, type ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import type { PassThrough } from "node:stream";
import type { Upload } from "@aws-sdk/lib-storage";
import { createStreamingUpload } from "../s3.ts";
import { updateRecordingStatus } from "./db.ts";
import { createProgressOperation, updateProgress, failOperation } from "../progress/db.ts";

type RecordingEvents = {
  start: [];
  progress: [{ bytesUploaded: number; elapsedMs: number }];
  end: [];
  error: [Error];
};

interface RecordingPipelineOptions {
  streamKey: string;
  recordingId: number;
  rtmpUrl: string;
  s3Key: string;
  meetingId: number;
}

const PROGRESS_UPDATE_INTERVAL_MS = 5000;
const RTMP_TIMEOUT_US = 10000000;

export class RecordingPipeline extends EventEmitter<RecordingEvents> {
  private ffmpeg: ChildProcess | null = null;
  private passThrough: PassThrough;
  private upload: Upload;
  private uploadPromise: Promise<void>;
  private bytesUploaded = 0;
  private startTime: number = 0;
  private isRunning = false;
  private reconnectionTimer: ReturnType<typeof setTimeout> | null = null;
  private progressOperationId: number | null = null;
  private lastProgressUpdate = 0;
  private restartAttempts = 0;
  private maxRestarts = 3;
  private isStopping = false;

  readonly recordingId: number;
  readonly streamKey: string;
  readonly s3Key: string;
  readonly meetingId: number;
  private readonly rtmpUrl: string;

  constructor(options: RecordingPipelineOptions) {
    super();
    this.recordingId = options.recordingId;
    this.streamKey = options.streamKey;
    this.s3Key = options.s3Key;
    this.meetingId = options.meetingId;
    this.rtmpUrl = options.rtmpUrl;

    const { passThrough, upload, promise } = createStreamingUpload({
      key: this.s3Key,
      contentType: "video/mp4",
    });
    this.passThrough = passThrough;
    this.upload = upload;
    this.uploadPromise = promise;

    this.passThrough.on("data", (chunk: Buffer) => {
      this.bytesUploaded += chunk.length;
      const elapsedMs = Date.now() - this.startTime;
      this.emit("progress", { bytesUploaded: this.bytesUploaded, elapsedMs });

      if (
        this.progressOperationId &&
        elapsedMs - this.lastProgressUpdate >= PROGRESS_UPDATE_INTERVAL_MS
      ) {
        this.lastProgressUpdate = elapsedMs;
        updateProgress(this.progressOperationId, 0, {
          recordingId: this.recordingId,
          stage: "recording",
          bytesUploaded: this.bytesUploaded,
          elapsedMs,
        }).catch((err) => {
          console.error(`[RecordingPipeline:${this.streamKey}] Failed to update progress:`, err);
        });
      }
    });
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn(`[RecordingPipeline:${this.streamKey}] Already running`);
      return;
    }

    try {
      this.isRunning = true;
      this.startTime = Date.now();

      this.progressOperationId = await createProgressOperation(this.meetingId, "recording", {
        recordingId: this.recordingId,
        stage: "recording",
      });

      await updateRecordingStatus(this.recordingId, "recording", {
        startedAt: new Date(),
      });

      console.info(`[RecordingPipeline:${this.streamKey}] Starting recording to ${this.s3Key}`);

      this.startFfmpeg();

      this.emit("start");
    } catch (err) {
      console.error(`[RecordingPipeline:${this.streamKey}] Failed to start:`, err);
      this.emit("error", err as Error);
      throw err;
    }
  }

  private startFfmpeg(): void {
    if (!this.isRunning) {
      return;
    }

    console.info(`[RecordingPipeline:${this.streamKey}] Starting FFmpeg for ${this.rtmpUrl}`);

    const ffmpegArgs = [
      "-i",
      this.rtmpUrl,
      "-c",
      "copy",
      "-f",
      "mp4",
      "-movflags",
      "frag_keyframe+empty_moov",
      "-timeout",
      String(RTMP_TIMEOUT_US),
      "pipe:1",
    ];

    this.ffmpeg = spawn("ffmpeg", ffmpegArgs, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    this.ffmpeg.stdout?.pipe(this.passThrough, { end: false });

    this.ffmpeg.stderr?.on("data", (data: Buffer) => {
      const message = data.toString();
      if (!message.includes("size=") && !message.includes("time=")) {
        console.info(`[RecordingPipeline:${this.streamKey}] FFmpeg: ${message.trim()}`);
      }
    });

    this.ffmpeg.on("error", (err) => {
      console.error(`[RecordingPipeline:${this.streamKey}] FFmpeg error:`, err);
      this.emit("error", err);
    });

    this.ffmpeg.on("close", (code) => {
      console.info(`[RecordingPipeline:${this.streamKey}] FFmpeg closed with code ${code}`);
      this.ffmpeg = null;

      if (this.isRunning && !this.reconnectionTimer && !this.isStopping) {
        if (this.restartAttempts < this.maxRestarts) {
          this.restartAttempts++;
          const backoffMs = Math.pow(2, this.restartAttempts - 1) * 1000;
          console.warn(
            `[RecordingPipeline:${this.streamKey}] FFmpeg crashed, restarting in ${backoffMs}ms (attempt ${this.restartAttempts}/${this.maxRestarts})`
          );
          setTimeout(() => this.startFfmpeg(), backoffMs);
        } else {
          console.error(
            `[RecordingPipeline:${this.streamKey}] FFmpeg crashed ${this.maxRestarts} times, aborting recording`
          );
          this.abort();
        }
      }
    });
  }

  private restartFfmpeg(): void {
    console.info(`[RecordingPipeline:${this.streamKey}] Restarting FFmpeg after reconnect`);

    if (this.ffmpeg) {
      this.ffmpeg.kill("SIGTERM");
      this.ffmpeg = null;
    }

    this.startFfmpeg();
  }

  startReconnectionGracePeriod(timeoutMs: number, onExpire: () => void): void {
    if (this.reconnectionTimer) {
      clearTimeout(this.reconnectionTimer);
    }

    console.info(
      `[RecordingPipeline:${this.streamKey}] Starting reconnection grace period (${timeoutMs}ms)`
    );

    this.reconnectionTimer = setTimeout(() => {
      console.warn(`[RecordingPipeline:${this.streamKey}] Reconnection grace period expired`);
      this.reconnectionTimer = null;
      onExpire();
    }, timeoutMs);
  }

  cancelReconnectionGracePeriod(): void {
    if (!this.reconnectionTimer) {
      console.warn(`[RecordingPipeline:${this.streamKey}] No active grace period to cancel`);
      return;
    }

    console.info(
      `[RecordingPipeline:${this.streamKey}] Reconnection successful, canceling grace period`
    );

    clearTimeout(this.reconnectionTimer);
    this.reconnectionTimer = null;

    this.restartAttempts = 0;
    this.restartFfmpeg();
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.warn(`[RecordingPipeline:${this.streamKey}] Not running`);
      return;
    }

    this.isStopping = true;

    console.info(`[RecordingPipeline:${this.streamKey}] Stopping recording`);

    try {
      this.isRunning = false;

      if (this.reconnectionTimer) {
        clearTimeout(this.reconnectionTimer);
        this.reconnectionTimer = null;
      }

      if (this.ffmpeg) {
        this.ffmpeg.kill("SIGTERM");
        this.ffmpeg = null;
      }

      this.passThrough.end();

      console.info(`[RecordingPipeline:${this.streamKey}] Waiting for S3 upload to complete...`);

      await this.uploadPromise;

      console.info(
        `[RecordingPipeline:${this.streamKey}] S3 upload completed (${this.bytesUploaded} bytes)`
      );

      await updateRecordingStatus(this.recordingId, "completed", {
        endedAt: new Date(),
        s3Key: this.s3Key,
        fileSize: this.bytesUploaded,
      });

      // Don't complete the progress operation here - let processRecording() handle it
      // This prevents a race condition where the operation is marked "completed" before
      // processRecording() can update it to "in_progress" with stage="processing"
      if (this.progressOperationId) {
        await updateProgress(this.progressOperationId, 100, {
          recordingId: this.recordingId,
          stage: "recording_complete",
          s3Key: this.s3Key,
          bytesUploaded: this.bytesUploaded,
        });
      }

      this.emit("end");
    } catch (err) {
      console.error(`[RecordingPipeline:${this.streamKey}] Failed to stop:`, err);
      this.emit("error", err as Error);
      throw err;
    } finally {
      this.isStopping = false;
    }
  }

  abort(): void {
    console.info(`[RecordingPipeline:${this.streamKey}] Aborting recording`);

    this.isRunning = false;

    if (this.reconnectionTimer) {
      clearTimeout(this.reconnectionTimer);
      this.reconnectionTimer = null;
    }

    if (this.ffmpeg) {
      this.ffmpeg.kill("SIGKILL");
      this.ffmpeg = null;
    }

    this.upload
      .abort()
      .then(() => {
        console.info(`[RecordingPipeline:${this.streamKey}] S3 upload aborted`);
      })
      .catch((err) => {
        console.error(`[RecordingPipeline:${this.streamKey}] Failed to abort S3 upload:`, err);
      });

    updateRecordingStatus(this.recordingId, "failed", {
      errorMessage: "Recording aborted",
      endedAt: new Date(),
    }).catch((err) => {
      console.error(
        `[RecordingPipeline:${this.streamKey}] Failed to update recording status:`,
        err
      );
    });

    if (this.progressOperationId) {
      failOperation(this.progressOperationId, "Recording aborted").catch((err) => {
        console.error(`[RecordingPipeline:${this.streamKey}] Failed to update progress:`, err);
      });
    }
  }

  get running(): boolean {
    return this.isRunning;
  }
}
