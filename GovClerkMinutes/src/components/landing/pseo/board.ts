import { LandingPageContent } from "@/types/landingPage";
import { defaultContent } from "./default";

export const content: LandingPageContent = {
  ...defaultContent,
  hero: {
    ...defaultContent.hero,
    title: "Create Board meeting minutes",
    subtitle: "Upload a board meeting recording and get high quality minutes",
  },
  features: [
    {
      ...defaultContent.features[0],
      description:
        "Upload a video or audio recording to get a transcript and board meeting minutes",
    },
    ...defaultContent.features.slice(1),
  ],
  faqs: [
    {
      ...defaultContent.faqs[0],
      q: "How do the AI generated board meeting minutes work?",
    },
    ...defaultContent.faqs.slice(1),
  ],
  finalCta: {
    ...defaultContent.finalCta,
    headline: "Start Generating Better Board Meeting Minutes Today",
  },
  seo: {
    ...defaultContent.seo,
    title: "GovClerkMinutes: Board Meeting Minutes Generator",
    description:
      "Automatically generate board meeting minutes from your audio or video recordings. Keep track of important decisions, tasks, and topics discussed during your meetings.",
    keywords:
      "Board, Meeting, Minutes, Generator, Transcription, Audio, Video, Productivity, Efficiency, AI, Board Meeting Minutes",
    canonical: "https://GovClerkMinutes.com/board-meeting-minutes",
  },
};
