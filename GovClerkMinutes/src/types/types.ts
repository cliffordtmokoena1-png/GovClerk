type Segment = {
  speaker: string;
  start: string;
  stop: string;
  transcript: string | null;
  is_user_visible: boolean;
};

type Speakers = {
  count: number;
  labels: string[];
  embeddings: {
    [key: string]: number[];
  };
};

export type TranscriptApiData = {
  segments: Segment[];
  speakers: Speakers;
};
