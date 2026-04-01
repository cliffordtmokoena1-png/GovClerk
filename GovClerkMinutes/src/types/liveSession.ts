export type StreamPlatform = "youtube" | "zoom" | "google_meet" | "facebook" | "rtmp" | "custom";

export interface StreamConfig {
  id: number;
  orgId: string;
  youtubeLiveUrl: string | null;
  youtubeChannelId: string | null;
  zoomJoinUrl: string | null;
  zoomWebinarId: string | null;
  googleMeetUrl: string | null;
  facebookLiveUrl: string | null;
  facebookPageId: string | null;
  rtmpHlsUrl: string | null;
  customEmbedUrl: string | null;
  preferredPlatform: StreamPlatform;
  isActive: boolean;
}

export type MotionType = "motion" | "resolution" | "ordinance" | "bylaw" | "amendment" | "procedural";
export type MotionStatus = "pending" | "open" | "passed" | "failed" | "tabled" | "withdrawn" | "amended";

export interface Motion {
  id: number;
  orgId: string;
  broadcastId: number;
  meetingId: number;
  agendaItemId: number | null;
  motionType: MotionType;
  title: string;
  description: string | null;
  movedBy: string | null;
  secondedBy: string | null;
  status: MotionStatus;
  voteResultSummary: string | null;
  ordinal: number;
  votes?: Vote[];
  createdAt: string;
  updatedAt: string;
}

export type VoteValue = "aye" | "nay" | "abstain" | "absent";

export interface Vote {
  id: number;
  orgId: string;
  motionId: number;
  broadcastId: number;
  memberName: string;
  memberId: string | null;
  vote: VoteValue;
  votedAt: string;
}

export interface VoteTally {
  aye: number;
  nay: number;
  abstain: number;
  absent: number;
  total: number;
  result: "passed" | "failed" | "tied" | "pending";
}

export type AttendanceStatus = "present" | "absent" | "late" | "excused";

export interface AttendanceRecord {
  id: number;
  orgId: string;
  meetingId: number;
  broadcastId: number;
  memberName: string;
  memberId: string | null;
  status: AttendanceStatus;
  arrivedAt: string | null;
  departedAt: string | null;
}

export type PublicCommentStatus = "pending" | "approved" | "spoken" | "rejected" | "withdrawn";

export interface PublicComment {
  id: number;
  orgId: string;
  meetingId: number;
  broadcastId: number | null;
  agendaItemId: number | null;
  speakerName: string;
  speakerEmail: string | null;
  topic: string;
  commentText: string | null;
  status: PublicCommentStatus;
  positionInQueue: number | null;
  timeLimitSeconds: number;
  submittedAt: string;
  spokenAt: string | null;
}

export type SpeakerType = "council_member" | "public" | "staff" | "guest";
export type SpeakerQueueStatus = "waiting" | "speaking" | "done" | "removed";

export interface SpeakerQueueEntry {
  id: number;
  orgId: string;
  broadcastId: number;
  speakerName: string;
  speakerType: SpeakerType;
  agendaItemId: number | null;
  position: number;
  status: SpeakerQueueStatus;
  timeLimitSeconds: number;
  startedSpeakingAt: string | null;
  finishedSpeakingAt: string | null;
  createdAt: string;
}

export interface LiveSessionResponse {
  broadcast: Omit<import("./broadcast").BroadcastWithMeeting, "streamKey"> | null;
  agenda: any[];
  segments: import("./broadcast").BroadcastTranscriptSegment[];
  streamConfig: StreamConfig | null;
  motions: Motion[];
  attendance: AttendanceRecord[];
  speakerQueue: SpeakerQueueEntry[];
  publicCommentQueue: PublicComment[];
}

export interface CreateMotionRequest {
  motionType: MotionType;
  title: string;
  description?: string;
  movedBy?: string;
  secondedBy?: string;
  agendaItemId?: number;
}

export interface CastVoteRequest {
  memberName: string;
  vote: VoteValue;
}

export interface RecordAttendanceRequest {
  memberName: string;
  status: AttendanceStatus;
}

export interface SubmitPublicCommentRequest {
  speakerName: string;
  speakerEmail?: string;
  topic: string;
  commentText?: string;
  agendaItemId?: number;
}
