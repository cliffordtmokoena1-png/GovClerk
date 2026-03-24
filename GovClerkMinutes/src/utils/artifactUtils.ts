import { LuFileText, LuFiles, LuVideo, LuImage, LuFileAudio, LuFile } from "react-icons/lu";
import type { IconType } from "react-icons";
import type { PortalArtifactType } from "@/types/portal";

export const ARTIFACT_TYPE_LABELS: Record<PortalArtifactType, string> = {
  logo: "Logo",
  agenda_pdf: "Agenda",
  agenda_packet: "Agenda Packet",
  minutes_pdf: "Minutes",
  minutes_packet: "Minutes Packet",
  meeting_recording: "Recording",
  minutes: "Minutes",
  agenda: "Agenda",
  recordings: "Recordings",
  transcripts: "Transcripts",
  other: "Other",
};

export function getArtifactTypeLabel(artifactType: PortalArtifactType): string {
  return ARTIFACT_TYPE_LABELS[artifactType] || artifactType;
}

export function getArtifactIcon(artifactType: PortalArtifactType): IconType {
  switch (artifactType) {
    case "agenda_pdf":
    case "minutes_pdf":
    case "minutes":
    case "agenda":
    case "transcripts":
      return LuFileText;
    case "agenda_packet":
    case "minutes_packet":
      return LuFiles;
    case "meeting_recording":
    case "recordings":
      return LuVideo;
    case "logo":
      return LuImage;
    default:
      return LuFile;
  }
}

export const MAX_FILE_SIZE_BYTES = 104857600;
export const MAX_FILE_SIZE_DISPLAY = "100MB";
