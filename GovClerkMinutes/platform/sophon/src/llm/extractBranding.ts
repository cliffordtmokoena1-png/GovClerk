import { callModel } from "./callModel.ts";

function makeBrandingSystemPrompt(): string {
  return [
    "You identify the most likely organization name and logo image URLs from a webpage.",
    "Return STRICT JSON only.",
    "Prefer high-resolution images, SVG or PNG if available.",
  ].join(" ");
}

const BRANDING_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    orgName: { type: "string" },
    logoUrls: { type: "array", items: { type: "string" } },
  },
  required: ["orgName", "logoUrls"],
} as const;

export type BrandingModelOutput = {
  orgName: string;
  logoUrls: string[];
};

export async function extractBranding(params: {
  pageUrl: string;
  title: string;
  description: string;
  textPreview: string;
  candidateImageUrls: string[];
}): Promise<BrandingModelOutput> {
  const system = {
    role: "system",
    content: makeBrandingSystemPrompt(),
  };
  const user = {
    role: "user",
    content: JSON.stringify(
      {
        page: {
          url: params.pageUrl,
          title: params.title,
          description: params.description,
          textPreview: params.textPreview.slice(0, 2000),
        },
        candidateImageUrls: params.candidateImageUrls,
        instruction:
          "Pick up to 3 logoUrls that best represent the organization's logo/branding. Provide a concise orgName (no suffix like '.com').",
      },
      null,
      2
    ),
  };
  return callModel<BrandingModelOutput>(
    "openai/gpt-5",
    "Branding",
    BRANDING_SCHEMA,
    [system, user],
    800
  );
}
