export type TemplateCategory =
  | "meeting-minutes"
  | "board-meeting"
  | "team-standup"
  | "project-review"
  | "nonprofit"
  | "healthcare"
  | "hr"
  | "construction"
  | "academic"
  | "legal"
  | "client-meeting"
  | "agm";

export interface Template {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  useCase: string;
  advantages: string[]; // List of key advantages/benefits of using this template
  preview: string; // Short preview of the template structure
  content: string; // Full markdown template
  isCustom: boolean;
}

export const TEMPLATE_CATEGORIES: Record<TemplateCategory, string> = {
  "meeting-minutes": "Meeting Minutes",
  "board-meeting": "Board Meeting",
  "team-standup": "Team Standup",
  "project-review": "Project Review",
  nonprofit: "Nonprofit",
  healthcare: "Healthcare",
  hr: "HR",
  construction: "Construction",
  academic: "Academic",
  legal: "Legal",
  "client-meeting": "Client Meeting",
  agm: "AGM",
};
