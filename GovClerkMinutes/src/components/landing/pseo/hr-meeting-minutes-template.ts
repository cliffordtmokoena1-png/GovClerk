import { LandingPageContent } from "@/types/landingPage";
import { defaultContent } from "./default";
import { hrMeetingTemplate } from "@/templates/minutes-library/08-hr-meeting";

export const content: LandingPageContent = {
  ...defaultContent,
  hero: {
    ...defaultContent.hero,
    title: "Create HR meeting minutes",
    subtitle: "Sign up and get your HR Meeting Minutes template for free",
    templatePreview: hrMeetingTemplate.preview,
  },
  features: [
    {
      title: "Legal Compliance",
      description: "Document employee decisions with legal compliance and consistent application",
      iconName: "MdGavel",
    },
    {
      title: "Performance Management",
      description: "Track performance discussions and development for effective talent management",
      iconName: "MdTrendingUp",
    },
    {
      title: "Confidentiality Protection",
      description: "Maintain confidential records of sensitive HR matters for audits",
      iconName: "MdSecurity",
    },
    {
      title: "Policy Documentation",
      description: "Record policy changes ensuring clear communication and compliance",
      iconName: "MdPolicy",
    },
  ],
  featuresHeading: {
    title: "Why the HR Meeting Minutes template?",
    subtitle: "Ensures compliance and confidentiality for HR meetings",
  },
  faqs: [
    {
      q: "Does this template maintain confidentiality for sensitive HR matters?",
      a: "Yes, the template is designed to document HR decisions while maintaining confidentiality. It includes appropriate confidentiality markers and structure for sensitive discussions.",
    },
    {
      q: "Is it compliant with employment law requirements?",
      a: "The template follows HR documentation best practices and helps ensure compliance with employment law documentation requirements.",
    },
    {
      q: "Can it track performance management discussions?",
      a: "Yes, the template includes sections for performance management, development initiatives, and talent management discussions.",
    },
    {
      q: "Does it help with audit preparation?",
      a: "Absolutely. The template creates proper documentation that supports HR audit requirements and demonstrates compliance with policies.",
    },
    {
      q: "Is it suitable for recruitment meetings?",
      a: "Yes, the template can be adapted for recruitment, employee relations, training, and all types of HR department meetings.",
    },
  ],
  pricing: {
    ...defaultContent.pricing,
    subtitle: "Handle sensitive HR matters efficiently.",
  },
  seo: {
    title: "HR Meeting Minutes Template - Employee Relations & Compliance Documentation",
    description:
      "Free HR meeting minutes template with confidentiality protection, policy tracking, and compliance documentation. Perfect for human resources departments.",
    keywords:
      "HR meeting minutes, human resources documentation, employee relations, performance management, HR compliance",
    canonical: "https://GovClerkMinutes.com/hr-meeting-minutes-template",
  },
};
