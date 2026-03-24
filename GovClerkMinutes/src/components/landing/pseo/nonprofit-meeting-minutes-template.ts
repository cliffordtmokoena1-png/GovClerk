import { LandingPageContent } from "@/types/landingPage";
import { defaultContent } from "./default";
import { nonprofitMeetingTemplate } from "@/templates/minutes-library/06-nonprofit-meeting";

export const content: LandingPageContent = {
  ...defaultContent,
  hero: {
    ...defaultContent.hero,
    title: "Create nonprofit meeting minutes",
    subtitle: "Sign up and get your Non-Profit Meeting Minutes template for free",
    templatePreview: nonprofitMeetingTemplate.preview,
  },
  features: [
    {
      title: "Regulatory Compliance",
      description: "Ensure legal compliance and transparency for regulatory bodies and donors",
      iconName: "MdVerifiedUser",
    },
    {
      title: "Mission Alignment",
      description: "Document mission-driven decisions for stakeholder accountability",
      iconName: "MdTrackChanges",
    },
    {
      title: "Donor Accountability",
      description: "Track resource allocation and financial decisions for transparent reporting",
      iconName: "MdAccountBalanceWallet",
    },
    {
      title: "Volunteer Coordination",
      description: "Manage volunteer activities and community engagement systematically",
      iconName: "MdVolunteerActivism",
    },
  ],
  featuresHeading: {
    title: "Why the Non-Profit Meeting Minutes template?",
    subtitle: "Ensures transparency, compliance, and accountability for non-profits",
  },
  faqs: [
    {
      q: "Is this template suitable for 501(c)(3) organizations?",
      a: "Yes! The template includes all sections required for non-profit board meetings and helps maintain compliance with IRS requirements for tax-exempt organizations.",
    },
    {
      q: "Does it help with donor reporting?",
      a: "Absolutely. The template documents financial decisions and resource allocation in a format that supports transparent donor reporting.",
    },
    {
      q: "Can it track volunteer activities?",
      a: "Yes, the template includes dedicated sections for volunteer coordination and community engagement tracking.",
    },
    {
      q: "Is it suitable for charity boards?",
      a: "Yes, this template works perfectly for charity organizations, community groups, and volunteer committees.",
    },
    {
      q: "Does it help with grant compliance?",
      a: "Yes, the documentation format supports grant reporting requirements and makes it easier to demonstrate program outcomes to funders.",
    },
  ],
  pricing: {
    ...defaultContent.pricing,
    subtitle: "Automate documentation and focus on your mission.",
  },
  seo: {
    title: "Non-Profit Meeting Minutes Template - Transparency & Compliance",
    description:
      "Free non-profit meeting minutes template with donor accountability, mission tracking, and regulatory compliance. Perfect for charities and community organizations.",
    keywords:
      "nonprofit meeting minutes, charity board minutes, 501c3 compliance, donor accountability, volunteer management",
    canonical: "https://GovClerkMinutes.com/nonprofit-meeting-minutes-template",
  },
};
