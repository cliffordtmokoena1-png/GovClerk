import { ARTIFACT_KINDS, type ArtifactSource, type Meeting } from "../types.ts";
import { callModel } from "./callModel.ts";

function makePageAnalysisSystemPrompt(): string {
  return [
    "You are a focused municipal meeting extraction engine.",
    "Instructions:",
    "- Group related documents (agenda, minutes, packets, html variants, media) into individual meeting objects.",
    "- Each meeting MUST have: a descriptive title (e.g. 'Town Board Meeting'), a 2025 date (YYYY-MM-DD), and its artifacts.",
    "- Pair agenda + minutes and include packet/html/media variants belonging to the same meeting date/context.",
    "- Do NOT merge multiple dates into one meeting object.",
    "- Only include meetings from the year 2025; ignore other years.",
    "- Use context rows/list items to infer meeting title & date; fall back to anchor text if needed.",
    "- If you cannot confidently determine a 2025 date, omit that meeting.",
    "Return STRICT JSON only.",
  ].join("\n");
}

// Schema for page analysis focusing on meetings and next links.
const PAGE_ANALYSIS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    nextLinks: { type: "array", items: { type: "string" } },
    pageMeetings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          kind: { type: "string" },
          date: { type: "string" },
          location: { type: "string" },
          artifacts: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                kind: {
                  enum: [
                    "agenda",
                    "minutes",
                    "agenda_packet",
                    "minutes_packet",
                    "agenda_html",
                    "minutes_html",
                    "media",
                  ],
                },
                name: { type: "string" },
                url: { type: "string" },
              },
              required: ["kind", "name", "url"],
            },
          },
        },
        required: ["title", "kind", "date", "location", "artifacts"],
      },
    },
  },
  required: ["nextLinks", "pageMeetings"],
} as const;

export type MeetingExtractions = {
  nextLinks: string[];
  pageMeetings: Array<Meeting<ArtifactSource>>;
};

export async function extractMeetings(params: {
  pageUrl: string;
  title: string;
  description: string;
  textPreview: string;
  candidateLinks: string[];
  structuredContext: Array<{ url: string; anchorText: string; contextText: string }>;
  maxBreadth: number;
}): Promise<MeetingExtractions> {
  const system = {
    role: "system",
    content: makePageAnalysisSystemPrompt(),
  };
  const user = {
    role: "user",
    content: JSON.stringify(
      {
        page: {
          url: params.pageUrl,
          title: params.title,
          description: params.description,
          textPreview: params.textPreview,
        },
        candidateLinks: params.candidateLinks,
        structuredContext: params.structuredContext,
        instruction: [
          `Choose up to ${params.maxBreadth} next links likely to lead to additional meeting-related documents.`,
          "Extract distinct 2025 meetings on this page, grouping agenda, minutes, packet, html, and media artifacts together per meeting.",
          "Use ISO dates.",
          "Do not invent data.",
          `Use artifact kind values: ${ARTIFACT_KINDS.join(", ")}.`,
        ].join(" "),
      },
      null,
      2
    ),
  };
  return callModel<MeetingExtractions>("openai/gpt-5", "PageAnalysis", PAGE_ANALYSIS_SCHEMA, [
    system,
    user,
  ]);
}
