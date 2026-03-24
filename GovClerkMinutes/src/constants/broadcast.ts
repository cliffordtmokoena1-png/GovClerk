import type { ReactNode } from "react";
import { LuPlayCircle, LuRadio, LuCheckCircle2, LuGavel } from "react-icons/lu";
import React from "react";

export type TranscriptMarkerType =
  | "go_live"
  | "pause"
  | "resume"
  | "end"
  | "agenda_clicked"
  | "agenda_completed"
  | "motion_added";

export const MARKER_COLORS: Record<TranscriptMarkerType, string> = {
  go_live: "bg-green-100 text-green-800 border-green-300",
  pause: "bg-orange-100 text-orange-800 border-orange-300",
  resume: "bg-accent text-primary border-primary/20",
  end: "bg-destructive/10 text-destructive border-destructive/20",
  agenda_clicked: "bg-accent text-primary border-primary/20",
  agenda_completed: "bg-green-50 text-green-700 border-green-200",
  motion_added: "bg-orange-50 text-orange-700 border-orange-200",
};

export const MARKER_LABELS: Record<TranscriptMarkerType, string> = {
  go_live: "Broadcast Went Live",
  pause: "Broadcast Paused",
  resume: "Broadcast Resumed",
  end: "Broadcast Ended",
  agenda_clicked: "Agenda Item Started",
  agenda_completed: "Agenda Item Completed",
  motion_added: "Motion Added",
};

export function getMarkerIcon(markerType: TranscriptMarkerType): ReactNode {
  const iconClass = "w-4 h-4";
  switch (markerType) {
    case "go_live":
    case "resume":
    case "agenda_clicked":
      return React.createElement(LuPlayCircle, { className: iconClass });
    case "pause":
    case "end":
      return React.createElement(LuRadio, { className: iconClass });
    case "agenda_completed":
      return React.createElement(LuCheckCircle2, { className: iconClass });
    case "motion_added":
      return React.createElement(LuGavel, { className: iconClass });
  }
}
