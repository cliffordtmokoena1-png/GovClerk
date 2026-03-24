import { LandingPageContent } from "@/types/landingPage";
import { defaultContent } from "./default";
import { clientMeetingTemplate } from "@/templates/minutes-library/12-client-meeting";

export const content: LandingPageContent = {
  ...defaultContent,
  hero: {
    ...defaultContent.hero,
    title: "Create client meeting minutes",
    subtitle: "Sign up and get your Client Meeting Minutes template for free",
    templatePreview: clientMeetingTemplate.preview,
  },
  features: [
    {
      title: "Requirements Clarity",
      description:
        "Document client requirements clearly preventing misunderstandings and scope creep",
      iconName: "MdChecklist",
    },
    {
      title: "Relationship Building",
      description: "Build strong client relationships through transparent communication",
      iconName: "MdHandshake",
    },
    {
      title: "Legal Protection",
      description: "Create clear records of agreements, timelines, and responsibilities",
      iconName: "MdGavel",
    },
    {
      title: "Project Alignment",
      description: "Ensure stakeholders align on project status, deliverables, and expectations",
      iconName: "MdTrackChanges",
    },
  ],
  featuresHeading: {
    title: "Why the Client Meeting Minutes template?",
    subtitle: "Ensure clear communication and project alignment with clients",
  },
  faqs: [
    {
      q: "Is this template suitable for consultants and agencies?",
      a: "Yes! This template is perfect for consultants, agencies, service providers, and account managers who meet regularly with clients.",
    },
    {
      q: "Does it help prevent scope creep?",
      a: "Absolutely. By documenting requirements and decisions clearly, the template creates a shared understanding that helps prevent scope creep.",
    },
    {
      q: "Can it track project deliverables?",
      a: "Yes, the template includes sections for tracking deliverables, timelines, and quality standards agreed upon with clients.",
    },
    {
      q: "Does it support relationship management?",
      a: "Yes, the professional format and thorough documentation helps build trust and strengthen client relationships.",
    },
    {
      q: "Is it useful for remote client meetings?",
      a: "Absolutely. The template works equally well for in-person and virtual client meetings.",
    },
  ],
  pricing: {
    ...defaultContent.pricing,
    subtitle: "Document meetings and strengthen client relationships.",
  },
  seo: {
    title: "Client Meeting Minutes Template - Project Updates & Requirements Documentation",
    description:
      "Free client meeting minutes template for consultants and agencies with deliverable tracking and feedback documentation. Build stronger client relationships.",
    keywords:
      "client meeting minutes, consultant documentation, project status meetings, deliverable tracking, client requirements",
    canonical: "https://GovClerkMinutes.com/client-meeting-minutes-template",
  },
};
