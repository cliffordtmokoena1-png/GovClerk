import { LandingPageContent } from "@/types/landingPage";
import { defaultContent } from "./default";
import { standardMeetingTemplate } from "@/templates/minutes-library/02-standard-meeting";

export const content: LandingPageContent = {
  ...defaultContent,
  hero: {
    ...defaultContent.hero,
    title: "Create standard meeting minutes",
    subtitle: "Sign up and get your Standard Meeting Minutes template for free",
    templatePreview: standardMeetingTemplate.preview,
  },
  features: [
    {
      title: "Complete Documentation",
      description: "Capture all discussions, decisions, and action items for future reference",
      iconName: "MdDescription",
    },
    {
      title: "Clear Accountability",
      description: "Assign tasks to individuals with defined deadlines for better performance",
      iconName: "MdPersonPin",
    },
    {
      title: "Standardized Format",
      description: "Consistent structure improves efficiency and professional communication",
      iconName: "MdFormatAlignLeft",
    },
    {
      title: "Action Item Management",
      description: "Track action items with owners and due dates to keep projects moving",
      iconName: "MdAssignment",
    },
  ],
  featuresHeading: {
    title: "Why the Standard Meeting Minutes template?",
    subtitle: "Professional format for comprehensive meeting documentation",
  },
  faqs: [
    {
      q: "What types of meetings is this template suitable for?",
      a: "This template works for corporate meetings, team meetings, departmental meetings, and general organizational gatherings. It's our most versatile format.",
    },
    {
      q: "Does the template include attendance tracking?",
      a: "Yes! The template has dedicated sections for tracking who was present and absent at the meeting.",
    },
    {
      q: "Can I customize the sections?",
      a: "Absolutely. You can add, remove, or modify sections to match your organization's specific meeting structure and requirements.",
    },
    {
      q: "How does this help with accountability?",
      a: "The template clearly assigns action items to specific people with deadlines, making it easy to follow up and track progress after meetings.",
    },
    {
      q: "Is this template compliant with corporate standards?",
      a: "Yes, the template follows standard meeting minute conventions and is suitable for corporate compliance and documentation requirements.",
    },
  ],
  pricing: {
    ...defaultContent.pricing,
    subtitle: "Buy back your time for high-value tasks.",
  },
  seo: {
    title: "Standard Meeting Minutes Template - Professional Format for Any Meeting",
    description:
      "Free standard meeting minutes template with sections for attendance, agenda, decisions, and action items. Perfect for corporate and team meetings.",
    keywords:
      "standard meeting minutes, meeting template, corporate meetings, team meetings, action items",
    canonical: "https://GovClerkMinutes.com/standard-meeting-minutes-template",
  },
};
