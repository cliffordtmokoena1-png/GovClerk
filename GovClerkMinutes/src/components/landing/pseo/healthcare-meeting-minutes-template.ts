import { LandingPageContent } from "@/types/landingPage";
import { defaultContent } from "./default";
import { healthcareMeetingTemplate } from "@/templates/minutes-library/07-healthcare-meeting";

export const content: LandingPageContent = {
  ...defaultContent,
  hero: {
    ...defaultContent.hero,
    title: "Create healthcare meeting minutes",
    subtitle: "Sign up and get your Healthcare Meeting Minutes template for free",
    templatePreview: healthcareMeetingTemplate.preview,
  },
  features: [
    {
      title: "Patient Safety Documentation",
      description: "Document patient safety protocols and clinical decisions for quality assurance",
      iconName: "MdLocalHospital",
    },
    {
      title: "Interdisciplinary Coordination",
      description: "Facilitate communication between medical specialties for comprehensive care",
      iconName: "MdGroups",
    },
    {
      title: "Regulatory Compliance",
      description: "Track medical policy updates and compliance for healthcare actokenation",
      iconName: "MdVerifiedUser",
    },
    {
      title: "Clinical Protocol Tracking",
      description: "Document clinical protocol changes and medical procedures for quality",
      iconName: "MdMedicalServices",
    },
  ],
  featuresHeading: {
    title: "Why the Healthcare Meeting Minutes template?",
    subtitle: "Specialized format for medical staff meetings focusing on patient care",
  },
  faqs: [
    {
      q: "Is this template suitable for medical staff meetings?",
      a: "Yes, this template is specifically designed for medical staff meetings, healthcare committees, clinical reviews, and interdisciplinary care team meetings.",
    },
    {
      q: "Does it help with actokenation compliance?",
      a: "Absolutely. The template includes sections for documenting quality metrics, policy updates, and regulatory compliance matters required for healthcare actokenation.",
    },
    {
      q: "Is it HIPAA-compliant?",
      a: "The template structure supports HIPAA confidentiality requirements, though you should always ensure any patient information is properly de-identified.",
    },
    {
      q: "Can it track patient safety metrics?",
      a: "Yes, the template includes dedicated sections for patient safety indicators and quality assurance metrics.",
    },
    {
      q: "Is it suitable for hospital committee meetings?",
      a: "Yes, this template works for all types of healthcare meetings including quality committees, medical staff meetings, and clinical protocol reviews.",
    },
  ],
  pricing: {
    ...defaultContent.pricing,
    subtitle: "Document meetings efficiently while maintaining quality.",
  },
  seo: {
    title: "Healthcare Meeting Minutes Template - Clinical & Patient Safety Documentation",
    description:
      "Free healthcare meeting minutes template for medical staff meetings with patient safety tracking and compliance documentation. HIPAA-conscious format.",
    keywords:
      "healthcare meeting minutes, medical staff meetings, patient safety, clinical protocols, HIPAA compliance",
    canonical: "https://GovClerkMinutes.com/healthcare-meeting-minutes-template",
  },
};
