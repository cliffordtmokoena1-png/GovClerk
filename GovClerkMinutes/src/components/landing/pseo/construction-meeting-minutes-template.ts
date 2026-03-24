import { LandingPageContent } from "@/types/landingPage";
import { defaultContent } from "./default";
import { constructionMeetingTemplate } from "@/templates/minutes-library/09-construction-meeting";

export const content: LandingPageContent = {
  ...defaultContent,
  hero: {
    ...defaultContent.hero,
    title: "Create construction meeting minutes",
    subtitle: "Sign up and get your Construction Meeting Minutes template for free",
    templatePreview: constructionMeetingTemplate.preview,
  },
  features: [
    {
      title: "Safety Compliance",
      description: "Document safety protocols and compliance for regulatory requirements",
      iconName: "MdSecurity",
    },
    {
      title: "Progress Tracking",
      description: "Track construction progress, delays, and milestones effectively",
      iconName: "MdTimeline",
    },
    {
      title: "Multi-Trade Coordination",
      description: "Coordinate multiple subcontractors with clear communication channels",
      iconName: "MdEngineering",
    },
    {
      title: "Cost Control",
      description: "Document budget discussions and change orders for accurate cost management",
      iconName: "MdAttachMoney",
    },
  ],
  featuresHeading: {
    title: "Why the Construction Meeting Minutes template?",
    subtitle: "Focus on safety, progress, and coordination for construction projects",
  },
  faqs: [
    {
      q: "Is this template suitable for general contractor meetings?",
      a: "Yes, this template is perfect for general contractors, subcontractors, architects, and all construction project stakeholders.",
    },
    {
      q: "Does it help with safety compliance?",
      a: "Absolutely. The template includes dedicated sections for safety protocols and incident reporting to support OSHA and regulatory compliance.",
    },
    {
      q: "Can it track multiple subcontractors?",
      a: "Yes, the template is designed to coordinate multiple trades and subcontractors with clear sections for each party's updates and responsibilities.",
    },
    {
      q: "Does it document change orders?",
      a: "Yes, the template includes sections for documenting change orders, budget impacts, and schedule adjustments.",
    },
    {
      q: "Is weather tracking included?",
      a: "Yes, the template tracks weather conditions and their impact on the construction schedule and progress.",
    },
  ],
  pricing: {
    ...defaultContent.pricing,
    subtitle: "Stay organized and compliant on complex projects.",
  },
  seo: {
    title: "Construction Meeting Minutes Template - Safety & Progress Tracking",
    description:
      "Free construction meeting minutes template with safety compliance, progress tracking, and subcontractor coordination. Perfect for construction managers.",
    keywords:
      "construction meeting minutes, construction project management, safety compliance, subcontractor coordination, change orders",
    canonical: "https://GovClerkMinutes.com/construction-meeting-minutes-template",
  },
};
