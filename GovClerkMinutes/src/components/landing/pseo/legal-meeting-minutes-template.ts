import { LandingPageContent } from "@/types/landingPage";
import { defaultContent } from "./default";
import { legalMeetingTemplate } from "@/templates/minutes-library/11-legal-meeting";

export const content: LandingPageContent = {
  ...defaultContent,
  hero: {
    ...defaultContent.hero,
    title: "Create legal meeting minutes",
    subtitle: "Sign up and get your Legal Meeting Minutes template for free",
    templatePreview: legalMeetingTemplate.preview,
  },
  features: [
    {
      title: "Privilege Protection",
      description: "Maintain attorney-client privilege and work product protection properly",
      iconName: "MdSecurity",
    },
    {
      title: "Case Management",
      description: "Track case progress, deadlines, and legal strategy effectively",
      iconName: "MdGavel",
    },
    {
      title: "Deadline Tracking",
      description: "Monitor critical dates and filing deadlines to prevent malpractice risks",
      iconName: "MdSchedule",
    },
    {
      title: "Ethical Compliance",
      description: "Ensure compliance with legal professional standards and ethical requirements",
      iconName: "MdVerifiedUser",
    },
  ],
  featuresHeading: {
    title: "Why the Legal Meeting Minutes template?",
    subtitle: "Protect privilege and track case management for legal teams",
  },
  faqs: [
    {
      q: "Does this template protect attorney-client privilege?",
      a: "Yes, the template is structured to maintain attorney-client privilege and work product protection with proper confidentiality markers.",
    },
    {
      q: "Is it suitable for law firms and legal departments?",
      a: "Absolutely. This template works for law firms, corporate legal departments, attorney meetings, and case review sessions.",
    },
    {
      q: "Can it track multiple cases simultaneously?",
      a: "Yes, the template can be used to track updates across multiple cases and matters in a single meeting.",
    },
    {
      q: "Does it help with deadline management?",
      a: "Yes, the template includes sections for tracking critical dates, filing deadlines, and discovery schedules.",
    },
    {
      q: "Is it appropriate for client meetings?",
      a: "While designed for internal legal team meetings, the template can be adapted for documenting client meetings while maintaining confidentiality.",
    },
  ],
  pricing: {
    header: "How much is your attorney time worth?",
    subtitle: "Document efficiently while protecting privilege.",
  },
  seo: {
    title: "Legal Meeting Minutes Template - Attorney-Client Privilege & Case Management",
    description:
      "Free legal meeting minutes template with privilege protection, case tracking, and deadline management. Perfect for law firms and legal departments.",
    keywords:
      "legal meeting minutes, attorney client privilege, case management, law firm documentation, legal deadlines",
    canonical: "https://GovClerkMinutes.com/legal-meeting-minutes-template",
  },
};
