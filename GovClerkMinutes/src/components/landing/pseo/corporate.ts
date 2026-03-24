import { LandingPageContent } from "@/types/landingPage";
import { defaultContent } from "./default";

export const content: LandingPageContent = {
  ...defaultContent,
  hero: {
    ...defaultContent.hero,
    title: "Create Corporate meeting minutes",
    subtitle: "Upload a corporate meeting recording and get high quality minutes",
  },
  features: [
    {
      ...defaultContent.features[0],
      description:
        "Upload a video or audio recording to get a transcript and corporate meeting minutes",
    },
    ...defaultContent.features.slice(1),
  ],
  faqs: [
    {
      ...defaultContent.faqs[0],
      q: "How do the AI generated corporate meeting minutes work?",
    },
    ...defaultContent.faqs.slice(1),
  ],
  finalCta: {
    ...defaultContent.finalCta,
    headline: "Start Generating Better Corporate Meeting Minutes Today",
  },
  seo: {
    ...defaultContent.seo,
    title: "GovClerkMinutes: Corporate Meeting Minutes Generator",
    description:
      "Automatically generate corporate meeting minutes from your audio or video recordings. Keep track of important decisions, tasks, and topics discussed during your meetings.",
    keywords:
      "Corporate, Meeting, Minutes, Generator, Transcription, Audio, Video, Productivity, Efficiency, AI, Corporate Meeting Minutes",
    canonical: "https://GovClerkMinutes.com/corporate-meeting-minutes",
  },
};
