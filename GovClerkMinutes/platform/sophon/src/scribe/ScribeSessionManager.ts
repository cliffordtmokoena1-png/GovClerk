import { EventEmitter } from "node:events";
import { ScribeRealtimeService, type TranscriptSegmentEvent } from "./ScribeRealtimeService.ts";

// 5 minutes - exported for use by other modules (e.g., HlsAudioExtractor)
export const DEFAULT_SESSION_TIMEOUT_MS = 300_000;

interface StreamSession {
  service: ScribeRealtimeService;
  createdAt: Date;
  lastAudioAt: Date;
}

type ManagerEvents = {
  transcript: [{ streamKey: string; segment: TranscriptSegmentEvent; sessionStartedAt: number }];
  error: [{ streamKey: string; error: Error }];
  sessionStarted: [{ streamKey: string }];
  sessionEnded: [{ streamKey: string }];
  /** Emitted when a session is automatically ended due to inactivity timeout */
  sessionTimeout: [{ streamKey: string; inactiveForMs: number }];
};

/**
 * Manages multiple Scribe real-time sessions, one per stream key.
 * Provides a centralized way to start/stop transcription for different broadcasts.
 *
 * Includes session timeout detection - automatically ends sessions that haven't
 * received audio data for the configured timeout period.
 */
export class ScribeSessionManager extends EventEmitter<ManagerEvents> {
  private readonly sessions = new Map<string, StreamSession>();
  private readonly apiKey: string;
  private readonly sessionTimeoutMs: number;
  private timeoutCheckInterval: ReturnType<typeof setInterval> | null = null;

  constructor(apiKey: string, options?: { sessionTimeoutMs?: number }) {
    super();
    this.apiKey = apiKey;
    this.sessionTimeoutMs = options?.sessionTimeoutMs ?? DEFAULT_SESSION_TIMEOUT_MS;
    this.startTimeoutChecker();
  }

  /**
   * Starts the interval that checks for stale sessions.
   */
  private startTimeoutChecker(): void {
    // Check every 10 seconds for timed-out sessions
    this.timeoutCheckInterval = setInterval(() => {
      this.checkForTimeouts();
    }, 10_000);
  }

  /**
   * Checks all sessions for timeout and ends stale ones.
   */
  private checkForTimeouts(): void {
    const now = Date.now();

    for (const [streamKey, session] of this.sessions) {
      const inactiveForMs = now - session.lastAudioAt.getTime();

      if (inactiveForMs >= this.sessionTimeoutMs) {
        console.warn(
          `[ScribeSessionManager] Session ${streamKey} timed out after ${(inactiveForMs / 1000).toFixed(1)}s of inactivity`
        );

        // End the session
        session.service.disconnect();
        this.sessions.delete(streamKey);

        // Emit timeout event before sessionEnded
        this.emit("sessionTimeout", { streamKey, inactiveForMs });
        this.emit("sessionEnded", { streamKey });
      }
    }
  }

  /**
   * Starts a new transcription session for a stream key.
   * If a session already exists, returns the existing service.
   */
  async startSession(
    streamKey: string,
    options?: { sampleRate?: number; languageCode?: string }
  ): Promise<ScribeRealtimeService> {
    const existing = this.sessions.get(streamKey);
    if (existing) {
      console.info(`[ScribeSessionManager] Session already exists for ${streamKey}`);
      return existing.service;
    }

    console.info(`[ScribeSessionManager] Starting new session for ${streamKey}`);

    const service = new ScribeRealtimeService({
      apiKey: this.apiKey,
      streamKey,
      sampleRate: options?.sampleRate ?? 16000,
      languageCode: options?.languageCode,
    });

    service.on("transcript", (segment) => {
      const session = this.sessions.get(streamKey);
      const sessionStartedAt = session?.createdAt.getTime() ?? Date.now();
      this.emit("transcript", { streamKey, segment, sessionStartedAt });
    });

    service.on("error", (error) => {
      this.emit("error", { streamKey, error });
    });

    service.on("disconnected", () => {
      this.sessions.delete(streamKey);
      this.emit("sessionEnded", { streamKey });
    });

    await service.connect();

    const now = new Date();
    this.sessions.set(streamKey, {
      service,
      createdAt: now,
      lastAudioAt: now,
    });

    this.emit("sessionStarted", { streamKey });
    return service;
  }

  /**
   * Gets an existing session for a stream key.
   */
  getSession(streamKey: string): ScribeRealtimeService | null {
    return this.sessions.get(streamKey)?.service ?? null;
  }

  /**
   * Sends audio to the session for the given stream key.
   * Updates the lastAudioAt timestamp to prevent timeout.
   * Does nothing if no session exists.
   */
  sendAudio(streamKey: string, audioChunk: Buffer): void {
    const session = this.sessions.get(streamKey);
    if (session) {
      session.lastAudioAt = new Date(); // Update last activity timestamp
      session.service.sendAudio(audioChunk);
    }
  }

  /**
   * Ends a transcription session for a stream key.
   */
  endSession(streamKey: string): void {
    const session = this.sessions.get(streamKey);
    if (session) {
      console.info(`[ScribeSessionManager] Ending session for ${streamKey}`);
      session.service.disconnect();
      this.sessions.delete(streamKey);
      this.emit("sessionEnded", { streamKey });
    }
  }

  /**
   * Ends all active sessions.
   */
  endAllSessions(): void {
    for (const [streamKey, session] of this.sessions) {
      console.info(`[ScribeSessionManager] Ending session for ${streamKey}`);
      session.service.disconnect();
    }
    this.sessions.clear();
  }

  /**
   * Stops the timeout checker and cleans up.
   * Call this when shutting down the manager.
   */
  destroy(): void {
    if (this.timeoutCheckInterval) {
      clearInterval(this.timeoutCheckInterval);
      this.timeoutCheckInterval = null;
    }
    this.endAllSessions();
  }

  /**
   * Returns the number of active sessions.
   */
  get sessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Returns all active stream keys.
   */
  get activeStreamKeys(): string[] {
    return Array.from(this.sessions.keys());
  }

  /**
   * Returns session info including last activity time.
   */
  getSessionInfo(
    streamKey: string
  ): { createdAt: Date; lastAudioAt: Date; inactiveForMs: number } | null {
    const session = this.sessions.get(streamKey);
    if (!session) return null;

    return {
      createdAt: session.createdAt,
      lastAudioAt: session.lastAudioAt,
      inactiveForMs: Date.now() - session.lastAudioAt.getTime(),
    };
  }
}

let manager: ScribeSessionManager | null = null;

/**
 * Gets or creates the global ScribeSessionManager instance.
 */
export function getScribeSessionManager(): ScribeSessionManager {
  if (!manager) {
    const apiKey = process.env.ELEVEN_LABS_API_KEY;
    if (!apiKey) {
      throw new Error(
        "ELEVEN_LABS_API_KEY environment variable is required for real-time transcription"
      );
    }
    manager = new ScribeSessionManager(apiKey, {
      sessionTimeoutMs: DEFAULT_SESSION_TIMEOUT_MS,
    });
  }
  return manager;
}
