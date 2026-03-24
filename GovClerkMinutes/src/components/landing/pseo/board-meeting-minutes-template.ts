import { LandingPageContent } from "@/types/landingPage";
import { defaultContent } from "./default";
import { boardMeetingTemplate } from "@/templates/minutes-library/03-board-meeting";

export const content: LandingPageContent = {
  ...defaultContent,
  hero: {
    ...defaultContent.hero,
    title: "Create board meeting minutes",
    subtitle: "Sign up and get your Board Meeting Minutes template for free",
    templatePreview: boardMeetingTemplate.preview,
  },
  features: [
    {
      title: "Legal Compliance",
      description: "Document governance requirements and regulatory obligations properly",
      iconName: "MdAccountBalance",
    },
    {
      title: "Motion & Voting Records",
      description: "Track formal motions, voting records, and board decisions for legal protection",
      iconName: "MdGavel",
    },
    {
      title: "Governance Procedures",
      description: "Maintain proper procedures for fiduciary duty and organizational oversight",
      iconName: "MdVerifiedUser",
    },
    {
      title: "Quorum Tracking",
      description: "Record attendance and quorum status to ensure meetings meet requirements",
      iconName: "MdPeople",
    },
  ],
  featuresHeading: {
    title: "Why the Board Meeting Minutes template?",
    subtitle: "Ensures legal compliance and proper governance for board meetings",
  },
  faqs: [
    {
      q: "Is this template legally compliant for board meetings?",
      a: "Yes, the template follows corporate governance best practices and includes all sections required for legal compliance with board meeting documentation requirements.",
    },
    {
      q: "Does it include voting record sections?",
      a: "Absolutely. The template has dedicated sections for recording motions, votes, and resolutions with proper formatting for legal documentation.",
    },
    {
      q: "Can this be used for executive committee meetings?",
      a: "Yes, the template is perfect for board of directors meetings, executive committee meetings, and all governance-level meetings.",
    },
    {
      q: "How does it help with fiduciary duty?",
      a: "The template ensures all board decisions and discussions are properly documented, creating the audit trail needed to demonstrate fulfillment of fiduciary responsibilities.",
    },
    {
      q: "Is quorum tracking included?",
      a: "Yes, the template includes sections for recording attendance and quorum status, which are essential for legally valid board meetings.",
    },
  ],
  pricing: {
    ...defaultContent.pricing,
    subtitle: "Efficient tools for critical governance work.",
  },
  seo: {
    title: "Board Meeting Minutes Template - Legal Compliance & Governance Format",
    description:
      "Free board meeting minutes template with motion tracking, voting records, and governance compliance. Perfect for board of directors and executive committees.",
    keywords:
      "board meeting minutes, board of directors, corporate governance, voting records, board resolutions",
    canonical: "https://GovClerkMinutes.com/board-meeting-minutes-template",
  },
};
