import { LandingPageContent } from "@/types/landingPage";
import { defaultContent } from "./default";

export const content: LandingPageContent = {
  ...defaultContent,
  hero: {
    ...defaultContent.hero,
    title: "Create minutes of the meeting",
    subheadline: "6,000+ professionals automate minutes of the meeting with us",
  },
  features: [
    {
      ...defaultContent.features[0],
      description:
        "Upload a video or audio recording to get a transcript and minutes of the meeting",
    },
    ...defaultContent.features.slice(1),
  ],
  faqs: [
    {
      ...defaultContent.faqs[0],
      q: "How do the AI generated minutes of the meeting work?",
    },
    ...defaultContent.faqs.slice(1),
  ],
  finalCta: {
    ...defaultContent.finalCta,
    headline: "Start Generating Better Minutes of the Meeting Today",
  },
  seo: {
    ...defaultContent.seo,
    title: "GovClerkMinutes: AI Minutes of the Meeting Generator",
    description:
      "Automatically generate minutes of the meeting from your audio or video recordings. Keep track of important decisions, tasks, and topics discussed during your meetings.",
    keywords:
      "Meeting, Minutes, Generator, Transcription, Audio, Video, Productivity, Efficiency, AI, Minutes of the Meeting",
    canonical: "https://GovClerkMinutes.com/minutes-of-the-meeting",
  },
};
