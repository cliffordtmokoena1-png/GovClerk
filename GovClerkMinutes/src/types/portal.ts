export type PortalArtifactType =
  | "logo"
  | "minutes_pdf"
  | "minutes_packet"
  | "minutes"
  | "agenda_pdf"
  | "agenda_packet"
  | "agenda"
  | "meeting_recording"
  | "recordings"
  | "transcripts"
  | "transcripts_pdf"
  | "transcripts_txt"
  | "other";

export const DOCUMENT_KIND_CONFIG: Record<PortalArtifactType, { label: string; iconName: string }> =
  {
    logo: { label: "Logo", iconName: "image" },
    minutes_pdf: { label: "Meeting Minutes", iconName: "file-text" },
    minutes_packet: { label: "Minutes Packet", iconName: "file-text" },
    minutes: { label: "Meeting Minutes", iconName: "file-text" },
    agenda_pdf: { label: "Agenda", iconName: "clipboard-list" },
    agenda_packet: { label: "Agenda Packet", iconName: "clipboard-list" },
    agenda: { label: "Agenda", iconName: "clipboard-list" },
    meeting_recording: { label: "Recordings", iconName: "video" },
    recordings: { label: "Recordings", iconName: "video" },
    transcripts: { label: "Transcripts", iconName: "file-audio" },
    transcripts_pdf: { label: "Transcripts PDF", iconName: "file-audio" },
    transcripts_txt: { label: "Transcripts TXT", iconName: "file-audio" },
    other: { label: "Other", iconName: "folder" },
  };

export const MEETING_DOCUMENT_KINDS: PortalArtifactType[] = [
  "agenda_packet",
  "agenda",
  "minutes",
  "recordings",
  "transcripts",
  "other",
];

export interface LinkedAgendaItem {
  id: number;
  title: string;
}

export interface PortalArtifact {
  id: number;
  orgId: string;
  portalSettingsId?: number;
  portalMeetingId?: number;
  artifactType: PortalArtifactType;
  fileName: string;
  fileSize: number;
  contentType?: string;
  s3Key: string;
  s3Url: string;
  isPublic: boolean;
  sourceTranscriptId?: string;
  sourceAgendaId?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  linkedAgendaItem?: LinkedAgendaItem;
}

export interface UploadPortalArtifactRequest {
  artifactType: PortalArtifactType;
  fileName: string;
  fileSize: number;
  contentType?: string;
  portalSettingsId?: string;
  portalMeetingId?: string;
}

export interface UploadPortalArtifactResponse {
  artifact: PortalArtifact;
  uploadUrl: string;
}

export interface NavLink {
  label: string;
  url: string;
}

export interface PortalSettings {
  id: number;
  orgId: string;
  slug: string;
  pageTitle: string | null;
  pageDescription: string | null;
  logoUrl: string | null;
  headerBgColor: string;
  headerTextColor: string;
  accentColor: string;
  navLinks: NavLink[] | null;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PortalMeeting {
  id: number;
  orgId: string;
  portalSettingsId: number;
  mgBoardId: number;
  title: string;
  description: string | null;
  meetingDate: string;
  location?: string;
  isPublic: boolean;
  tags?: string[];
  isCancelled?: boolean;
  createdAt: string;
  updatedAt: string;
  minutesTranscriptId?: number;
  minutesVersion?: number;
}

export interface PortalMeetingWithArtifacts extends PortalMeeting {
  artifacts?: PortalArtifact[];
}

export interface CreatePortalSettingsRequest {
  slug: string;
  pageTitle?: string;
  pageDescription?: string;
  logoUrl?: string;
  headerBgColor?: string;
  headerTextColor?: string;
  accentColor?: string;
  navLinks?: NavLink[];
  isEnabled?: boolean;
}

export interface UpdatePortalSettingsRequest {
  pageTitle?: string;
  pageDescription?: string;
  logoUrl?: string;
  headerBgColor?: string;
  headerTextColor?: string;
  accentColor?: string;
  navLinks?: NavLink[];
  isEnabled?: boolean;
}

export interface CreatePortalMeetingRequest {
  title: string;
  description?: string;
  meetingDate: string;
  location?: string;
  isPublic?: boolean;
  tags?: string[];
  isCancelled?: boolean;
  mgBoardId: number;
}

export type UpdatePortalMeetingRequest = Partial<CreatePortalMeetingRequest> & {
  minutesVersion?: number | null;
};

export interface PortalSettingsResponse {
  settings: PortalSettings;
}

export interface PortalSettingsListResponse {
  settings: PortalSettings | null;
}

export interface PortalMeetingResponse {
  meeting: PortalMeeting;
}

export interface PortalMeetingsListResponse {
  meetings: PortalMeeting[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PortalMeetingsWithArtifactsListResponse {
  meetings: PortalMeetingWithArtifacts[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PublicPortalResponse {
  settings: Pick<
    PortalSettings,
    | "id"
    | "slug"
    | "pageTitle"
    | "pageDescription"
    | "logoUrl"
    | "headerBgColor"
    | "headerTextColor"
    | "accentColor"
    | "navLinks"
  >;
}

export interface PublicMeetingListItem {
  id: number;
  title: string;
  description: string | null;
  meetingDate: string;
  tags?: string[];
  isCancelled?: boolean;
  artifacts?: PortalArtifact[];
}

export interface PublicMeetingDetail {
  id: number;
  title: string;
  description: string | null;
  meetingDate: string;
  tags?: string[];
  isCancelled?: boolean;
  artifacts: PortalArtifact[];
}

export interface PublicMeetingResponse {
  meeting: PublicMeetingDetail;
}

export interface PublicMeetingsListResponse {
  meetings: PublicMeetingListItem[];
  total: number;
  page: number;
  pageSize: number;
}

// Portal user types
export type PortalUserRole = "admin" | "member" | "readonly";

export interface PortalUser {
  id: number;
  orgId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: PortalUserRole;
  emailDomain: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PortalSharedPassword {
  id: number;
  orgId: string;
  label: string;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface PortalLoginRequest {
  slug: string;
  email: string;
  password: string;
}

export interface PortalSharedLoginRequest {
  slug: string;
  password: string;
}

export interface PortalLoginResponse {
  success: boolean;
  authType: "email" | "shared";
  email?: string;
  role?: PortalUserRole;
}

export interface PortalSessionResponse {
  isAuthenticated: boolean;
  authType?: "email" | "shared";
  email?: string;
  role?: PortalUserRole;
  orgId?: string;
  expiresAt?: string;
  hasActiveSubscription?: boolean;
  subscriptionTier?: string;
  isGovClerkAdmin?: boolean;
  portalMode?: "live" | "demo";
}

export interface CreatePortalUserRequest {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  role?: PortalUserRole;
}

export interface CreateSharedPasswordRequest {
  label: string;
  password: string;
  expiresAt?: string;
}
