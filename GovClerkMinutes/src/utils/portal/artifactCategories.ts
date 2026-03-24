import { PortalArtifactType } from "@/types/portal";

export type ArtifactCategory = "documents" | "media";

export function getArtifactCategory(type: PortalArtifactType): ArtifactCategory {
  const mediaTypes: PortalArtifactType[] = ["meeting_recording", "recordings"];
  return mediaTypes.includes(type) ? "media" : "documents";
}
