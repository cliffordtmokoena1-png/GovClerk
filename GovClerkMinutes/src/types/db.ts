export interface BoardMemberRow {
  id?: number;
  org_id: string;
  board_id: number;
  user_id: string;
  title: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface MotionRow {
  id: number;
  org_id: string;
  agenda_item_id: number;
  title: string;
  description: string | null;
  mover: string | null;
  seconder: string | null;
  is_withdrawn: boolean | number;
  is_tabled: boolean | number;
  ordinal: number;
  created_at: string;
  updated_at: string;
  votes_for?: number;
  votes_against?: number;
  votes_abstain?: number;
}

export interface VoteRow {
  id: number;
  org_id: string;
  motion_id: number;
  user_id: string;
  board_member_id: number | null;
  vote_value: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgendaItemRow {
  id: number;
  org_id: string;
  agenda_id: number;
  parent_id: number | null;
  title: string;
  description: string | null;
  minutes: string | null;
  is_section: boolean | number;
  ordinal: number;
  created_at: string;
  updated_at: string;
}

export interface MeetingRow {
  id: number;
  org_id: string;
  board_id: number | null;
  title?: string;
  date?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ArtifactRow {
  id: number;
  org_id: string;
  portal_settings_id: number;
  meeting_id: number;
  artifact_type: string;
  file_name: string;
  file_size: number;
  content_type: string | null;
  s3_key: string;
  s3_url: string;
  is_public: boolean | number;
  version: number;
  created_at: string;
  updated_at: string;
}
