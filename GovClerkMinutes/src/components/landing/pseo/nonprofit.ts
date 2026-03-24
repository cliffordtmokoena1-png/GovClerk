import { LandingPageContent } from "@/types/landingPage";
import { defaultContent } from "./default";

export const content: LandingPageContent = {
  ...defaultContent,
  hero: {
    ...defaultContent.hero,
    title: "Create Non-profit meeting minutes",
    subtitle: "Upload a non-profit meeting recording and get high quality minutes",
  },
  features: [
    {
      ...defaultContent.features[0],
      description:
        "Upload a video or audio recording to get a transcript and non-profit meeting minutes",
    },
    ...defaultContent.features.slice(1),
  ],
  faqs: [
    {
      ...defaultContent.faqs[0],
      q: "How do the AI generated non-profit meeting minutes work?",
    },
    ...defaultContent.faqs.slice(1),
  ],
  finalCta: {
    ...defaultContent.finalCta,
    headline: "Start Generating Better Non-profit Meeting Minutes Today",
  },
  seo: {
    ...defaultContent.seo,
    title: "GovClerkMinutes: Non-profit Meeting Minutes Generator",
    description:
      "Automatically generate non-profit meeting minutes from your audio or video recordings. Keep track of important decisions, tasks, and topics discussed during your meetings.",
    keywords:
      "Non-profit, Meeting, Minutes, Generator, Transcription, Audio, Video, Productivity, Efficiency, AI, Non-profit Meeting Minutes",
    canonical: "https://GovClerkMinutes.com/nonprofit-meeting-minutes",
  },
};
