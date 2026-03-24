export namespace SophonWebSocket {
  export type IncomingMessage =
    | StreamStarted
    | StreamEnded
    | StreamTimeout
    | TranscriptSegment
    | TranscriptMarker
    | AgendaUpdate
    | BroadcastUpdate;

  export interface StreamStarted {
    kind: "stream_started";
    streamKey: string;
  }

  export interface StreamEnded {
    kind: "stream_ended";
    streamKey: string;
  }

  /** Emitted when a stream times out due to inactivity */
  export interface StreamTimeout {
    kind: "stream_timeout";
    streamKey?: string;
    reason: string;
    timestamp: number;
  }

  /** Word-level data with speaker diarization info */
  export interface TranscriptWord {
    text: string;
    start?: number;
    end?: number;
    type?: "word" | "spacing";
    speakerId?: string;
  }

  export interface TranscriptSegment {
    kind: "transcript_segment";
    streamKey?: string;
    segmentId: string;
    /** Speaker ID from diarization - null for partial transcripts or when speaker cannot be determined */
    speaker: string | null;
    text: string;
    isFinal: boolean;
    languageCode?: string;
    /** Word-level data with timestamps and speaker info (only available for final transcripts) */
    words?: TranscriptWord[];
    /** Unix timestamp (ms) when the transcription session started - used to calculate elapsed time */
    sessionStartedAt?: number;
  }

  export type MarkerType =
    | "go_live"
    | "pause"
    | "resume"
    | "end"
    | "agenda_clicked"
    | "agenda_completed"
    | "motion_added";

  export interface TranscriptMarker {
    kind: "transcript_marker";
    streamKey?: string;
    markerType: MarkerType;
    timestamp: number; // Unix timestamp in ms
    label?: string;
    agendaItemId?: number;
    motionId?: number;
  }

  export interface AgendaUpdate {
    kind: "agenda_update";
    streamKey?: string;
    meetingId: number;
  }

  export interface BroadcastUpdate {
    kind: "broadcast_update";
    streamKey?: string;
    broadcastId: number;
    currentAgendaItemId: number | null;
    status: string;
    agendaTimestamps?: Array<{
      agendaItemId: number;
      activatedAt: string;
      recordingPositionMs: number | null;
    }>;
  }
}
