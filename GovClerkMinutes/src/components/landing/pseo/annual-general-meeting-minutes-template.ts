import { LandingPageContent } from "@/types/landingPage";
import { defaultContent } from "./default";
import { annualGeneralMeetingTemplate } from "@/templates/minutes-library/13-annual-general-meeting";

export const content: LandingPageContent = {
  ...defaultContent,
  hero: {
    ...defaultContent.hero,
    title: "Create annual general meeting minutes",
    subtitle: "Sign up and get your Annual General Meeting Minutes template for free",
    templatePreview: annualGeneralMeetingTemplate.preview,
  },
  features: [
    {
      title: "Regulatory Compliance",
      description: "Ensure legal compliance with corporate governance and regulatory obligations",
      iconName: "MdVerifiedUser",
    },
    {
      title: "Election Management",
      description: "Facilitate proper election procedures with clear records of voting and results",
      iconName: "MdHowToVote",
    },
    {
      title: "Financial Reporting",
      description: "Document financial statements presentation and approval transparently",
      iconName: "MdAccountBalance",
    },
    {
      title: "Resolution Recording",
      description: "Document major organizational resolutions and policy changes comprehensively",
      iconName: "MdGavel",
    },
  ],
  featuresHeading: {
    title: "Why the Annual General Meeting Minutes template?",
    subtitle: "Ensure compliance with elections, financial reporting, and major decisions",
  },
  faqs: [
    {
      q: "Is this template suitable for corporate AGMs?",
      a: "Yes, this template is perfect for corporations, non-profits, associations, and member organizations holding annual general meetings.",
    },
    {
      q: "Does it include election procedures?",
      a: "Absolutely. The template has comprehensive sections for nominations, voting procedures, and recording election results.",
    },
    {
      q: "Can it handle financial statement approvals?",
      a: "Yes, the template includes sections for presenting and approving financial statements and auditor reports.",
    },
    {
      q: "Is quorum tracking included?",
      a: "Yes, the template tracks total membership, attendance, and quorum status to ensure meeting validity.",
    },
    {
      q: "Does it work for shareholder meetings?",
      a: "Yes, this template works excellently for shareholder AGMs and can be adapted for various membership structures.",
    },
  ],
  pricing: {
    ...defaultContent.pricing,
    subtitle: "Ensure compliance and accuracy for critical annual events.",
  },
  seo: {
    title: "Annual General Meeting Minutes Template - AGM Elections & Compliance",
    description:
      "Free AGM minutes template with election management, financial reporting, and quorum tracking. Perfect for corporations and member organizations.",
    keywords:
      "AGM minutes, annual general meeting, shareholder meeting, election procedures, corporate governance, financial statements",
    canonical: "https://GovClerkMinutes.com/annual-general-meeting-minutes-template",
  },
};
