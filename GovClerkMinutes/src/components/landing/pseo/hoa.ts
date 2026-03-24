import { LandingPageContent } from "@/types/landingPage";
import { defaultContent } from "./default";

export const content: LandingPageContent = {
  ...defaultContent,
  hero: {
    ...defaultContent.hero,
    title: "Create HOA meeting minutes",
    subtitle: "Upload a homeowner association meeting recording and get high quality minutes",
    image: "/landing-product-hoa.webp",
    mobileImage: "/landing-product-mobile-hoa.webp",
  },
  features: [
    {
      ...defaultContent.features[0],
      description: "Upload a video or audio recording to get a transcript and HOA meeting minutes",
    },
    ...defaultContent.features.slice(1),
  ],
  faqs: [
    {
      ...defaultContent.faqs[0],
      q: "How do the AI generated HOA meeting minutes work?",
    },
    ...defaultContent.faqs.slice(1),
  ],
  finalCta: {
    ...defaultContent.finalCta,
    headline: "Start Generating Better HOA Meeting Minutes Today",
  },
  seo: {
    ...defaultContent.seo,
    title: "GovClerkMinutes: HOA Meeting Minutes Generator",
    description:
      "Automatically generate HOA meeting minutes from your audio or video recordings. Keep track of important decisions, tasks, and topics discussed during your meetings.",
    keywords:
      "HOA, Meeting, Minutes, Generator, Transcription, Audio, Video, Productivity, Efficiency, AI, HOA Meeting Minutes",
    canonical: "https://GovClerkMinutes.com/hoa-meeting-minutes",
  },
};
