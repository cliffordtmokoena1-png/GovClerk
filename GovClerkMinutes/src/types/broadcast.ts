export type BroadcastStatus = "setup" | "live" | "paused" | "ended";

export interface AgendaTimestamp {
  agendaItemId: number;
  activatedAt: string;
  recordingPositionMs: number | null;
}

export interface Broadcast {
  id: number;
  orgId: string;
  mgMeetingId: number;
  startedByUserId: string;
  streamKey: string;
  status: BroadcastStatus;
  currentAgendaItemId: number | null;
  notes: string | null;
  agendaTimestamps: AgendaTimestamp[];
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BroadcastWithMeeting extends Broadcast {
  meeting: {
    id: number;
    title: string;
    description: string | null;
    meetingDate: string;
  };
}

export interface BroadcastTranscriptSegment {
  id: number;
  mgBroadcastId: number;
  segmentIndex: number;
  speakerId: string | null;
  speakerLabel: string | null;
  text: string;
  startTime: number | null;
  endTime: number | null;
  isFinal: boolean;
  createdAt: string;
}

export interface CreateBroadcastRequest {
  mgMeetingId: number;
}

export interface UpdateBroadcastRequest {
  status?: BroadcastStatus;
  currentAgendaItemId?: number | null;
  notes?: string;
  recordingPositionMs?: number;
}

export interface BroadcastResponse {
  broadcast: BroadcastWithMeeting;
}

export interface ActiveBroadcastResponse {
  broadcast: BroadcastWithMeeting | null;
  isOwner: boolean;
  ownerName?: string;
}

export interface TranscriptSegmentResponse {
  segments: BroadcastTranscriptSegment[];
}
