import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import {
  AudioFormat,
  CommitStrategy,
  RealtimeEvents,
  type RealtimeConnection,
} from "@elevenlabs/elevenlabs-js";
import { EventEmitter } from "node:events";

interface SessionStartedMessage {
  message_type: "session_started";
  session_id: string;
}

interface PartialTranscriptMessage {
  message_type: "partial_transcript";
  text: string;
}

/** Word-level data with speaker diarization info */
export interface TranscriptWord {
  text: string;
  start?: number;
  end?: number;
  type?: "word" | "spacing";
  speakerId?: string;
}

interface CommittedTranscriptWithTimestampsMessage {
  message_type: "committed_transcript_with_timestamps";
  text: string;
  language_code?: string;
  words?: Array<{
    text?: string;
    start?: number;
    end?: number;
    type?: "word" | "spacing";
    speaker_id?: string;
  }>;
}

export interface TranscriptSegmentEvent {
  segmentId: string;
  /** Speaker ID from diarization - null for partial transcripts or when speaker cannot be determined */
  speaker: string | null;
  text: string;
  isFinal: boolean;
  languageCode?: string;
  /** Word-level data with timestamps and speaker info (only available for final transcripts with timestamps enabled) */
  words?: TranscriptWord[];
}

export interface ScribeRealtimeServiceOptions {
  apiKey: string;
  streamKey: string;
  sampleRate?: number;
  languageCode?: string;
}

type ServiceEvents = {
  transcript: [TranscriptSegmentEvent];
  error: [Error];
  connected: [];
  disconnected: [];
};

/**
 * Service for real-time speech-to-text transcription using ElevenLabs Scribe v2.
 * Manages the WebSocket connection to ElevenLabs and emits transcript events.
 */
export class ScribeRealtimeService extends EventEmitter<ServiceEvents> {
  private readonly client: ElevenLabsClient;
  private connection: RealtimeConnection | null = null;
  private readonly streamKey: string;
  private readonly sampleRate: number;
  private readonly languageCode?: string;
  private isConnected = false;
  private sessionStarted = false;
  private audioBuffer: Buffer[] = [];
  private totalAudioBytesSent = 0;
  private lastLoggedBytes = 0;
  private readonly logIntervalBytes = 64000;
  private segmentCounter = 0;
  private readonly sentenceSegmenter = new Intl.Segmenter("en", { granularity: "sentence" });

  constructor(options: ScribeRealtimeServiceOptions) {
    super();
    this.client = new ElevenLabsClient({ apiKey: options.apiKey });
    this.streamKey = options.streamKey;
    this.sampleRate = options.sampleRate ?? 16000;
    this.languageCode = options.languageCode;
  }

  /**
   * Connects to the ElevenLabs Scribe v2 real-time WebSocket.
   * Must be called before sending audio.
   */
  async connect(): Promise<void> {
    if (this.connection) {
      console.warn(`[ScribeRealtime:${this.streamKey}] Already connected`);
      return;
    }

    console.info(`[ScribeRealtime:${this.streamKey}] Connecting to ElevenLabs...`);

    try {
      // Determine the audio format based on sample rate
      const audioFormat = this.getAudioFormat(this.sampleRate);

      this.connection = await this.client.speechToText.realtime.connect({
        modelId: "scribe_v2_realtime",
        audioFormat,
        sampleRate: this.sampleRate,
        commitStrategy: CommitStrategy.VAD,
        languageCode: this.languageCode,
        includeTimestamps: true,
        vadSilenceThresholdSecs: 3.0,
      });

      this.setupEventHandlers();
      this.isConnected = true;
      this.emit("connected");
      console.info(`[ScribeRealtime:${this.streamKey}] Connected to ElevenLabs`);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error(`[ScribeRealtime:${this.streamKey}] Connection failed:`, error);
      this.emit("error", error);
      throw error;
    }
  }

  /**
   * Maps sample rate to ElevenLabs AudioFormat enum.
   */
  private getAudioFormat(sampleRate: number): AudioFormat {
    switch (sampleRate) {
      case 8000:
        return AudioFormat.PCM_8000;
      case 16000:
        return AudioFormat.PCM_16000;
      case 22050:
        return AudioFormat.PCM_22050;
      case 24000:
        return AudioFormat.PCM_24000;
      case 44100:
        return AudioFormat.PCM_44100;
      case 48000:
        return AudioFormat.PCM_48000;
      default:
        console.warn(
          `[ScribeRealtime:${this.streamKey}] Unknown sample rate ${sampleRate}, defaulting to PCM_16000`
        );
        return AudioFormat.PCM_16000;
    }
  }

  /**
   * Sets up event handlers for the ElevenLabs WebSocket connection.
   */
  private setupEventHandlers(): void {
    if (!this.connection) {
      return;
    }

    this.connection.on(RealtimeEvents.SESSION_STARTED, (data: SessionStartedMessage) => {
      console.info(`[ScribeRealtime:${this.streamKey}] Session started: ${data.session_id}`);
      this.sessionStarted = true;

      // Flush buffered audio now that session is ready
      if (this.audioBuffer.length > 0) {
        console.info(
          `[ScribeRealtime:${this.streamKey}] Flushing ${this.audioBuffer.length} buffered audio chunks`
        );
        for (const chunk of this.audioBuffer) {
          this.sendAudioImmediate(chunk);
        }
        this.audioBuffer = [];
      }
    });

    // PARTIAL_TRANSCRIPT: Segment into sentences and emit as rolling text for live display
    // These are "uncommitted" - frontend displays but doesn't persist
    // When COMMITTED_TRANSCRIPT_WITH_TIMESTAMPS arrives, frontend clears these and shows committed versions
    this.connection.on(RealtimeEvents.PARTIAL_TRANSCRIPT, (data: PartialTranscriptMessage) => {
      const fullText = data.text.trim();
      if (!fullText) return;

      // Segment the partial text into sentences
      const segments = [...this.sentenceSegmenter.segment(fullText)];
      const sentences = segments.map((seg) => seg.segment.trim()).filter((text) => text.length > 0);

      // Emit each sentence as a non-final segment
      // Frontend will display these as uncommitted rolling text
      sentences.forEach((sentenceText, index) => {
        this.emit("transcript", {
          segmentId: `partial-${this.streamKey}-${index}`,
          speaker: null,
          text: sentenceText,
          isFinal: false,
        });
      });
    });

    // COMMITTED_TRANSCRIPT_WITH_TIMESTAMPS: The finalized transcript with word-level timestamps
    // Parse into sentence segments and emit each with timestamps
    this.connection.on(
      RealtimeEvents.COMMITTED_TRANSCRIPT_WITH_TIMESTAMPS,
      (data: CommittedTranscriptWithTimestampsMessage) => {
        if (!data.words || data.words.length === 0) {
          // Fallback: emit entire text as single segment if no word data
          if (data.text.trim()) {
            const segmentId = `seg-${this.streamKey}-${++this.segmentCounter}`;
            this.emit("transcript", {
              segmentId,
              speaker: null,
              text: data.text.trim(),
              isFinal: true,
              languageCode: data.language_code,
            });
          }
          return;
        }

        // Split committed transcript into sentence segments based on punctuation
        const sentenceSegments = this.splitIntoSentences(data.words);

        for (const segment of sentenceSegments) {
          const segmentId = `seg-${this.streamKey}-${++this.segmentCounter}`;
          this.emit("transcript", {
            segmentId,
            speaker: null,
            text: segment.text,
            isFinal: true,
            languageCode: data.language_code,
            words: segment.words,
          });
        }
      }
    );

    this.connection.on(RealtimeEvents.ERROR, (err: unknown) => {
      console.error(`[ScribeRealtime:${this.streamKey}] Error:`, err);
      const error = err instanceof Error ? err : new Error(String(err));
      this.emit("error", error);
    });

    this.connection.on(RealtimeEvents.CLOSE, () => {
      console.info(`[ScribeRealtime:${this.streamKey}] Connection closed`);
      this.isConnected = false;
      this.emit("disconnected");
    });
  }

  /**
   * Split word array into sentence segments based on sentence-ending punctuation.
   */
  private splitIntoSentences(
    words: NonNullable<CommittedTranscriptWithTimestampsMessage["words"]>
  ): Array<{ words: TranscriptWord[]; text: string }> {
    const sentenceEndingPattern = /[.!?]$/;
    const segments: Array<{ words: TranscriptWord[]; text: string }> = [];

    let currentWords: TranscriptWord[] = [];
    let currentText: string[] = [];

    for (const word of words) {
      const transcriptWord: TranscriptWord = {
        text: word.text || "",
        start: word.start,
        end: word.end,
        type: word.type,
        speakerId: word.speaker_id,
      };

      currentWords.push(transcriptWord);
      currentText.push(word.text || "");

      const wordText = (word.text || "").trim();
      if (word.type === "word" && sentenceEndingPattern.test(wordText)) {
        segments.push({
          words: currentWords,
          text: currentText.join("").trim(),
        });
        currentWords = [];
        currentText = [];
      }
    }

    // Don't lose remaining words that didn't end with punctuation
    if (currentWords.length > 0) {
      const text = currentText.join("").trim();
      if (text) {
        segments.push({
          words: currentWords,
          text,
        });
      }
    }

    return segments;
  }

  /**
   * Sends a chunk of PCM audio data to the transcription service.
   * Audio should be 16-bit signed little-endian PCM.
   * Will buffer audio until session is ready.
   *
   * @param audioChunk - Raw PCM audio data as a Buffer
   */
  sendAudio(audioChunk: Buffer): void {
    if (!this.connection || !this.isConnected) {
      console.warn(`[ScribeRealtime:${this.streamKey}] Cannot send audio: not connected`);
      return;
    }

    if (!this.sessionStarted) {
      this.audioBuffer.push(audioChunk);
      const maxBufferSize = 5 * 16000 * 2;
      let totalBuffered = this.audioBuffer.reduce((sum, buf) => sum + buf.length, 0);
      while (totalBuffered > maxBufferSize && this.audioBuffer.length > 0) {
        const removed = this.audioBuffer.shift();
        if (removed) {
          totalBuffered -= removed.length;
        }
      }
      return;
    }

    this.sendAudioImmediate(audioChunk);
  }

  private sendAudioImmediate(audioChunk: Buffer): void {
    if (!this.connection) {
      return;
    }

    this.totalAudioBytesSent += audioChunk.length;
    if (this.totalAudioBytesSent - this.lastLoggedBytes >= this.logIntervalBytes) {
      const durationSecs = this.totalAudioBytesSent / (16000 * 2);
      console.info(
        `[ScribeRealtime:${this.streamKey}] Sent ${this.totalAudioBytesSent} bytes (~${durationSecs.toFixed(1)}s) to ElevenLabs`
      );
      this.lastLoggedBytes = this.totalAudioBytesSent;
    }

    const base64Audio = audioChunk.toString("base64");
    this.connection.send({
      audioBase64: base64Audio,
      sampleRate: this.sampleRate,
    });
  }

  /**
   * Manually commits the current audio buffer for transcription.
   * Required only when using CommitStrategy.MANUAL.
   */
  commit(): void {
    if (!this.connection || !this.isConnected) {
      console.warn(`[ScribeRealtime:${this.streamKey}] Cannot commit: not connected`);
      return;
    }

    this.connection.commit();
  }

  /**
   * Disconnects from the transcription service and cleans up resources.
   */
  disconnect(): void {
    if (this.connection) {
      console.info(`[ScribeRealtime:${this.streamKey}] Disconnecting...`);
      this.connection.close();
      this.connection = null;
      this.isConnected = false;
    }
  }

  /**
   * Returns whether the service is currently connected.
   */
  get connected(): boolean {
    return this.isConnected;
  }
}
