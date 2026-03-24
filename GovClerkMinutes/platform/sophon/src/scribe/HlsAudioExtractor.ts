import { spawn, type ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";

/** Default timeout in milliseconds for detecting stream inactivity (30 seconds) */
const DEFAULT_INACTIVITY_TIMEOUT_MS = 30_000;

type ExtractorEvents = {
  data: [Buffer];
  error: [Error];
  close: [];
  /** Emitted when no audio data has been received for the configured timeout period */
  timeout: [];
};

/**
 * Extracts audio from an HLS stream using FFmpeg.
 * Outputs 16-bit signed PCM at 16kHz mono - suitable for ElevenLabs Scribe.
 *
 * Includes inactivity timeout detection - emits 'timeout' event when no audio
 * data is received for the configured period, indicating the stream may have disconnected.
 */
export class HlsAudioExtractor extends EventEmitter<ExtractorEvents> {
  private ffmpeg: ChildProcess | null = null;
  private readonly hlsUrl: string;
  private readonly streamKey: string;
  private isRunning = false;
  private totalBytesEmitted = 0;
  private lastLoggedBytes = 0;
  private readonly logIntervalBytes = 64000;
  private readonly inactivityTimeoutMs: number;
  private inactivityTimer: ReturnType<typeof setTimeout> | null = null;
  private lastDataReceivedAt: number = 0;

  constructor(hlsUrl: string, streamKey: string, options?: { inactivityTimeoutMs?: number }) {
    super();
    this.hlsUrl = hlsUrl;
    this.streamKey = streamKey;
    this.inactivityTimeoutMs = options?.inactivityTimeoutMs ?? DEFAULT_INACTIVITY_TIMEOUT_MS;
  }

  /**
   * Start extracting audio from the HLS stream.
   * Will retry connecting to HLS until successful or stopped.
   */
  start(): void {
    if (this.isRunning) {
      console.warn(`[HlsAudioExtractor:${this.streamKey}] Already running`);
      return;
    }

    this.isRunning = true;
    this.lastDataReceivedAt = Date.now();
    this.startInactivityTimer();
    this.startFfmpeg();
  }

  /**
   * Starts the inactivity timer that checks for stream disconnection.
   */
  private startInactivityTimer(): void {
    this.stopInactivityTimer();

    this.inactivityTimer = setInterval(() => {
      if (!this.isRunning) {
        this.stopInactivityTimer();
        return;
      }

      const elapsed = Date.now() - this.lastDataReceivedAt;
      if (elapsed >= this.inactivityTimeoutMs) {
        console.warn(
          `[HlsAudioExtractor:${this.streamKey}] No audio data received for ${(elapsed / 1000).toFixed(1)}s, emitting timeout`
        );
        this.emit("timeout");
        // Don't stop the timer - let the caller decide what to do
      }
    }, 5000); // Check every 5 seconds
  }

  /**
   * Stops the inactivity timer.
   */
  private stopInactivityTimer(): void {
    if (this.inactivityTimer) {
      clearInterval(this.inactivityTimer);
      this.inactivityTimer = null;
    }
  }

  private startFfmpeg(): void {
    if (!this.isRunning) {
      return;
    }

    console.info(`[HlsAudioExtractor:${this.streamKey}] Starting FFmpeg for ${this.hlsUrl}`);

    this.ffmpeg = spawn(
      "ffmpeg",
      [
        "-reconnect",
        "1",
        "-reconnect_streamed",
        "1",
        "-reconnect_delay_max",
        "5",
        "-i",
        this.hlsUrl,
        "-vn",
        "-acodec",
        "pcm_s16le",
        "-ar",
        "16000",
        "-ac",
        "1",
        "-f",
        "s16le",
        "-",
      ],
      {
        stdio: ["ignore", "pipe", "pipe"],
      }
    );

    this.ffmpeg.stdout?.on("data", (chunk: Buffer) => {
      this.totalBytesEmitted += chunk.length;
      this.lastDataReceivedAt = Date.now(); // Reset inactivity timer on data

      if (this.totalBytesEmitted - this.lastLoggedBytes >= this.logIntervalBytes) {
        const durationSecs = this.totalBytesEmitted / (16000 * 2);
        console.info(
          `[HlsAudioExtractor:${this.streamKey}] Audio progress: ${this.totalBytesEmitted} bytes (~${durationSecs.toFixed(1)}s)`
        );
        this.lastLoggedBytes = this.totalBytesEmitted;
      }
      this.emit("data", chunk);
    });

    this.ffmpeg.stderr?.on("data", (data: Buffer) => {
      const message = data.toString();
      // Only log non-progress messages
      if (!message.includes("size=") && !message.includes("time=")) {
        console.info(`[HlsAudioExtractor:${this.streamKey}] FFmpeg: ${message.trim()}`);
      }
    });

    this.ffmpeg.on("error", (err) => {
      console.error(`[HlsAudioExtractor:${this.streamKey}] FFmpeg error:`, err);
      this.emit("error", err);
    });

    this.ffmpeg.on("close", (code) => {
      console.info(`[HlsAudioExtractor:${this.streamKey}] FFmpeg closed with code ${code}`);
      this.ffmpeg = null;

      if (this.isRunning) {
        console.info(`[HlsAudioExtractor:${this.streamKey}] Restarting FFmpeg in 3 seconds...`);
        setTimeout(() => this.startFfmpeg(), 3000);
      } else {
        this.emit("close");
      }
    });
  }

  /**
   * Stop extracting audio.
   */
  stop(): void {
    console.info(`[HlsAudioExtractor:${this.streamKey}] Stopping`);
    this.isRunning = false;
    this.stopInactivityTimer();

    if (this.ffmpeg) {
      this.ffmpeg.kill("SIGTERM");
      this.ffmpeg = null;
    }
  }

  get running(): boolean {
    return this.isRunning;
  }

  /**
   * Returns the time in milliseconds since last audio data was received.
   */
  get timeSinceLastData(): number {
    return Date.now() - this.lastDataReceivedAt;
  }
}
