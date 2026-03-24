export interface Transcript {
  id: number;
  userId: string;
  title: string;
  s3AudioKey: string;
  file_size: number;
  aws_region: string;
  upload_kind: string;
  [key: string]: any;
}

export interface Minute {
  transcript_id: number;
  user_id: string;
  minutes: string;
  rating: number | null;
  ms_word_clicks: number;
  copy_clicks: number;
  version: number;
  fast_mode: number;
  [key: string]: any;
}

export interface Speaker {
  transcriptId: number;
  label: string;
  name: string;
  uses: number;
  userId: string;
  embedding: number[] | null;
  fast_mode: number;
  suggested_speakers: any;
  [key: string]: any;
}

export interface Segment {
  transcript_id: number;
  start: string | number;
  stop: string | number;
  speaker: string;
  transcript: string | null;
  segment_index: number;
  fast_mode: number;
  is_user_visible: number;
  [key: string]: any;
}

export interface Change {
  transcript_id: number;
  revision_id: number | string;
  user_id: string;
  change_type: string;
  diff_content: string;
  base_version: number;
  new_version: number;
  fast_mode: number;
  [key: string]: any;
}

export interface TemplateData {
  transcripts: Transcript[];
  minutes: Minute[];
  speakers: Speaker[];
  gc_segments: Segment[];
  changes: Change[];
}
