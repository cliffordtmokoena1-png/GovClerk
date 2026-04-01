// FOIA / Public Records
export type RecordsRequestType = "foia" | "open_records" | "inspection" | "certification";
export type RecordsRequestStatus =
  | "received"
  | "acknowledged"
  | "in_review"
  | "fulfilled"
  | "partially_fulfilled"
  | "denied"
  | "withdrawn";

export interface PublicRecordsRequest {
  id: number;
  orgId: string;
  requesterName: string;
  requesterEmail: string;
  requesterPhone: string | null;
  requestType: RecordsRequestType;
  description: string;
  dateRangeFrom: string | null;
  dateRangeTo: string | null;
  relatedMeetingId: number | null;
  status: RecordsRequestStatus;
  denialReason: string | null;
  responseDueDate: string | null;
  fulfilledAt: string | null;
  responseNotes: string | null;
  trackingNumber: string;
  submittedAt: string;
  updatedAt: string;
}

export interface SubmitRecordsRequestBody {
  requesterName: string;
  requesterEmail: string;
  requesterPhone?: string;
  requestType: RecordsRequestType;
  description: string;
  dateRangeFrom?: string;
  dateRangeTo?: string;
  relatedMeetingId?: number;
}

export interface SubmitRecordsRequestResponse {
  success: true;
  trackingNumber: string;
  message: string;
}

export interface TrackRequestResponse {
  trackingNumber: string;
  status: RecordsRequestStatus;
  submittedAt: string;
  responseDueDate: string | null;
  denialReason: string | null;
  fulfilledAt: string | null;
}

// Meeting Notice
export type MeetingNoticeType =
  | "regular"
  | "special"
  | "emergency"
  | "executive_session"
  | "cancelled"
  | "rescheduled";

export interface MeetingNotice {
  id: number;
  orgId: string;
  meetingId: number;
  noticeType: MeetingNoticeType;
  postedAt: string;
  noticeText: string | null;
  postingLocation: string | null;
  hoursNoticeGiven: number | null;
  isCompliant: boolean | null;
}

// Document Retention
export interface DocumentRetention {
  artifactId: number;
  documentType: string;
  retentionPeriod: string;
  retentionBasis: string | null;
  destructionDate: string | null;
  isPermanent: boolean;
}

// Portal Announcement
export type AnnouncementType = "notice" | "alert" | "info" | "emergency";

export interface PortalAnnouncement {
  id: number;
  orgId: string;
  title: string;
  body: string;
  type: AnnouncementType;
  isActive: boolean;
  publishedAt: string;
  expiresAt: string | null;
}

// Records index (for full-text search)
export interface PublicRecordsSearchResult {
  id: number;
  type: "meeting" | "artifact" | "notice";
  title: string;
  description: string | null;
  date: string;
  meetingId?: number;
  artifactId?: number;
  artifactType?: string;
  downloadUrl?: string;
  tags?: string[];
}

export interface PublicRecordsSearchResponse {
  results: PublicRecordsSearchResult[];
  total: number;
  page: number;
  pageSize: number;
  query: string;
}

// Meeting calendar
export interface CalendarMeeting {
  id: number;
  title: string;
  meetingDate: string;
  location: string | null;
  description: string | null;
  tags: string[] | null;
  isCancelled: boolean;
  hasPublicArtifacts: boolean;
  noticePostedAt: string | null;
  isCompliant: boolean | null;
}

export interface MeetingCalendarResponse {
  meetings: CalendarMeeting[];
  month: number;
  year: number;
}
