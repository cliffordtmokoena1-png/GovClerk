export interface MgAgenda {
  id: number;
  org_id: string;
  meeting_id: number;
  created_at: Date;
  updated_at: Date;
}

export interface MgAgendaItem {
  id: number;
  org_id: string;
  agenda_id: number;
  parent_id: number | null;
  title: string;
  description: string | null;
  minutes: string | null;
  is_section: boolean;
  ordinal: number;
  created_at: Date;
  updated_at: Date;
}

export interface MgAgendaArtifactsGroup {
  id: number;
  agenda_item_id: number;
  artifact_id: number;
  ordinal: number;
  created_at: Date;
}

export type MotionStatus = "pending" | "passed" | "failed" | "tabled" | "withdrawn";
export type VoteType = "yes" | "no" | "abstain" | "absent";

export interface MgVote {
  id: number;
  org_id: string;
  motion_id: number;
  user_id: string;
  board_member_id: number | null;
  vote_value: VoteType | null;
  created_at: Date;
  updated_at: Date;
}

export interface MgMotion {
  id: number;
  org_id: string;
  agenda_item_id: number;
  title: string;
  description: string | null;
  mover: string | null;
  seconder: string | null;
  is_withdrawn: boolean;
  is_tabled: boolean;
  ordinal: number;
  created_at: Date;
  updated_at: Date;
  votes?: MgVote[];
  votes_for?: number;
  votes_against?: number;
  votes_abstain?: number;
}

export interface MgAgendaItemWithRelations extends MgAgendaItem {
  artifacts?: import("./portal").PortalArtifact[];
  motions?: MgMotion[];
  children?: MgAgendaItemWithRelations[];
}

export interface MgAgendaWithItems extends MgAgenda {
  items: MgAgendaItemWithRelations[];
}

export interface CreateAgendaInput {
  org_id: string;
  meeting_id: number;
}

export interface CreateAgendaItemInput {
  org_id: string;
  agenda_id: number;
  title: string;
  description?: string;
  is_section?: boolean;
  ordinal: number;
  parent_id?: number | null;
}

export interface UpdateAgendaItemInput {
  title?: string;
  description?: string;
  minutes?: string;
  is_section?: boolean;
  ordinal?: number;
  parent_id?: number | null;
}

export interface CreateMotionInput {
  org_id: string;
  agenda_item_id: number;
  title: string;
  description?: string;
  mover?: string;
  seconder?: string;
  ordinal: number;
}

export interface UpdateMotionInput {
  title?: string;
  description?: string;
  mover?: string;
  seconder?: string;
  is_withdrawn?: boolean;
  is_tabled?: boolean;
  ordinal?: number;
}

export interface CreateVoteInput {
  org_id: string;
  motion_id: number;
  user_id: string;
  board_member_id?: number;
  vote_value: VoteType | null;
}

export interface UpdateVoteInput {
  user_id: string;
  board_member_id?: number;
  vote_value: VoteType | null;
}

export interface MotionWithVotes extends MgMotion {
  votes: MgVote[];
  vote_counts: {
    yes: number;
    no: number;
    abstain: number;
  };
}

export interface ReorderAgendaItemsInput {
  items: Array<{ id: number; ordinal: number; parent_id?: number | null }>;
}

export interface AgendaVersion {
  id: number;
  version: number;
  content: string | null;
  status: string;
  updatedAt: string;
}

export interface AgendaDetail {
  id: number;
  seriesId: string;
  title: string | null;
  sourceKind: string;
  sourceText: string;
  content: string | null;
  status: string;
  version: number;
  versions: AgendaVersion[];
  createdAt: string;
  updatedAt: string;
}

export interface GeneratedMotion {
  title: string;
  description?: string;
  mover?: string;
  seconder?: string;
}

export interface GeneratedAgendaItem {
  title: string;
  description?: string;
  is_section: boolean;
  motions?: GeneratedMotion[];
  children?: GeneratedAgendaItem[];
}

export interface AgendaTemplateItem {
  title: string;
  description?: string;
  is_section: boolean;
  children?: AgendaTemplateItem[];
}

export interface AgendaTemplate {
  id: number;
  org_id: string;
  name: string;
  description?: string;
  template_data: {
    items: AgendaTemplateItem[];
  };
  created_at: string;
  updated_at: string;
}

export interface CreateAgendaTemplateRequest {
  name: string;
  description?: string;
  orgId: string;
}

export interface CreateAgendaTemplateResponse {
  template: AgendaTemplate;
}

export interface AgendaTemplatesResponse {
  templates: AgendaTemplate[];
}

export interface LoadTemplateRequest {
  templateId: number;
  orgId: string;
}

export interface LoadTemplateResponse {
  items: GeneratedAgendaItem[];
}
