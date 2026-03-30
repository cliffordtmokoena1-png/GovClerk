export interface TranscriptRow {
  id: number;
  userId: string;
  org_id: string | null;
  title: string | null;
  upload_kind: string;
  s3AudioKey: string | null;
  aws_region: string;
  transcribe_finished: number;
  transcribe_paused: number;
  credits_required: number | null;
  language: string | null;
  upload_complete: number;
}

export interface MinutesRow {
  id: number;
  transcript_id: number;
  user_id: string;
  minutes: string | null;
  version: number;
  ts_start: string;
}

export interface JobStatus {
  transcript_id: number;
  status: 'pending' | 'transcribing' | 'generating_minutes' | 'complete' | 'failed';
  started_at: Date;
}

// In-memory job tracker
export const activeJobs = new Map<number, JobStatus>();