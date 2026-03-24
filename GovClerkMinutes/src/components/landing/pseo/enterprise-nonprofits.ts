import { LandingPageContent } from "@/types/landingPage";
import { defaultContent } from "./default";

export const content: LandingPageContent = {
  ...defaultContent,
  hero: {
    ...defaultContent.hero,
    title: "Nonprofit Meeting Minutes",
    subtitle:
      "Streamline board meetings, donor discussions, and volunteer coordination with AI-powered documentation.",
    subheadline: "Trusted by nonprofits and charitable organizations worldwide",
  },
  featuresHeading: {
    title: "Built for Mission-Driven Organizations",
    subtitle: "Features designed specifically for nonprofit needs and compliance",
  },
  features: [
    {
      title: "Board & Governance Meetings",
      description:
        "Professional documentation for board meetings, committee sessions, and stakeholder discussions with compliance-ready formatting and secure archival.",
      iconName: "LuUsers",
    },
    {
      title: "Grant & Compliance Documentation",
      description:
        "Meet funder requirements with detailed meeting records, decision tracking, and audit-ready documentation for grant applications and reporting.",
      iconName: "LuShield",
    },
    {
      title: "Volunteer & Donor Management",
      description:
        "Document volunteer committee meetings, donor advisory sessions, and fundraising planning meetings with organized action items and follow-ups.",
      iconName: "LuUserPlus",
    },
    {
      title: "Nonprofit Pricing",
      description:
        "Special discounted pricing for 501(c)(3) organizations with flexible plans that fit your budget and mission-focused operations.",
      iconName: "LuDollarSign",
    },
  ],
  pricing: {
    header: "Nonprofit Organization Pricing",
    subtitle: "Special discounted rates for 501(c)(3) and charitable organizations",
  },
  letter: {
    targetPersona: "Nonprofit Leader",
  },
  finalCta: {
    headline: "Support Your Mission with Better Documentation",
    buttonText: "Request Nonprofit Pricing",
  },
  seo: {
    title: "GovClerkMinutes for Nonprofits: Meeting Minutes for Charitable Organizations",
    description:
      "Meeting documentation software for nonprofit organizations. Special pricing for 501(c)(3) organizations. Streamline board meetings, grant documentation, and compliance requirements.",
    keywords:
      "Nonprofit, Charity, Meeting Minutes, Board Meetings, Grant Documentation, 501c3, Nonprofit Software, Governance, Compliance",
    canonical: "https://GovClerkMinutes.com/enterprise/nonprofits",
  },
};
