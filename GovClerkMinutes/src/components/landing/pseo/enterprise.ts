import { LandingPageContent } from "@/types/landingPage";
import { defaultContent } from "./default";

export const content: LandingPageContent = {
  ...defaultContent,
  hero: {
    ...defaultContent.hero,
    title: "Enterprise Meeting Minutes",
    subtitle: "Empower your entire organization with AI-powered meeting minutes and transcription.",
    subheadline: "Trusted by enterprise teams worldwide",
  },
  featuresHeading: {
    title: "Built for Enterprise Scale",
    subtitle: "Everything your organization needs to streamline meeting documentation",
  },
  features: [
    {
      title: "Unlimited Meeting Hours",
      description:
        "Process unlimited meetings with no monthly caps. Scale documentation across your entire organization without usage constraints.",
      iconName: "LuClock",
    },
    {
      title: "Advanced Security & Compliance",
      description:
        "Enterprise-grade security with SOC 2 compliance, SSO integration, and advanced access controls to protect your sensitive data.",
      iconName: "LuShield",
    },
    {
      title: "Dedicated Account Manager",
      description:
        "White-glove service with a dedicated account manager for onboarding, training, and ongoing strategic support.",
      iconName: "LuUserPlus",
    },
    {
      title: "Custom Integrations",
      description:
        "Seamlessly integrate with your existing tools and workflows including Slack, Teams, Salesforce, and custom APIs.",
      iconName: "LuLibrary",
    },
  ],
  pricing: {
    header: "Enterprise Pricing Built for Your Scale",
    subtitle: "Custom plans tailored to your organization's needs and volume",
  },
  letter: {
    targetPersona: "Enterprise Leader",
  },
  finalCta: {
    headline: "Transform Your Organization's Meeting Documentation",
    buttonText: "Contact Sales",
  },
  seo: {
    title: "GovClerkMinutes Enterprise: AI Meeting Minutes for Organizations",
    description:
      "Enterprise meeting documentation solution with unlimited hours, dedicated support, and custom integrations. Scale AI-powered meeting minutes across your entire organization.",
    keywords:
      "Enterprise, Meeting Minutes, AI Transcription, Business Documentation, Custom Integration, Dedicated Support, Enterprise Software",
    canonical: "https://GovClerkMinutes.com/enterprise",
  },
};
