export type PresignedUrl = {
  partNumber: number;
  url: string;
  start: number;
  end: number;
  eTag: string | null;
};

export type ApiRefreshPresignedUrlResponse = {
  transcriptId: number;
  presignedUrls: Array<{ partNumber: number; url: string }>;
};
