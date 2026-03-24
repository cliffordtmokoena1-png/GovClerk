export interface Plan {
  // Root URL to start crawling from
  root: string;
  // Max depth to search to (root is depth 0)
  maxDepth: number;
  // Max number of links to try at each level
  maxBreadth: number;
}

export const ARTIFACT_KINDS = [
  "agenda",
  "minutes",
  "logo",
  "agenda_packet",
  "minutes_packet",
  "agenda_html",
  "minutes_html",
  "media",
] as const;

export type ArtifactKind = (typeof ARTIFACT_KINDS)[number];

export interface ArtifactSource {
  kind: ArtifactKind;
  name: string;
  url: string;
}

// Object representing a document like meeting minutes, or a meeting agenda, etc.
// Could also be any data stored in s3, such as an organization's logo
export interface Artifact {
  kind: ArtifactKind;
  name: string;
  bucket: string; // S3 bucket name
  key: string; // S3 key
  mime: string | null; // mime type if known; null until resolved after download
}

export interface Meeting<TArtifact = Artifact> {
  // Meeting title, e.g. calendar invite title
  title: string;
  // What type of meeting, e.g. "Zoning Board Meeting", or "City Council Meeting"
  kind: string;
  // ISO timestamp of when the meeting was held. If no time, then assume midnight
  date: string;
  // Address or location of the meeting
  location?: string;
  artifacts: TArtifact[];
}

export interface Manifest {
  orgName: string;
  domain: string;
  // Logo may be discovered after initial pages
  logo?: Artifact;
  meetings: Meeting<ArtifactSource>[];
}

export interface ExtractedPageInfo {
  title: string;
  description: string;
  textPreview: string;
  links: string[];
}
