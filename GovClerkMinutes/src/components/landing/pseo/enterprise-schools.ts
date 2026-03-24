import { LandingPageContent } from "@/types/landingPage";
import { defaultContent } from "./default";

export const content: LandingPageContent = {
  ...defaultContent,
  hero: {
    ...defaultContent.hero,
    title: "School Meeting Minutes",
    subtitle:
      "Streamline faculty meetings, board sessions, and administrative documentation across your institution.",
    subheadline: "Trusted by schools, colleges, and universities worldwide",
  },
  featuresHeading: {
    title: "Built for Educational Excellence",
    subtitle: "Tailored features for academic institutions and school administration",
  },
  features: [
    {
      title: "Department & Committee Meetings",
      description:
        "Perfect for faculty meetings, academic committees, parent-teacher conferences, and board sessions with automatic speaker tracking and structured formatting.",
      iconName: "LuUsers",
    },
    {
      title: "Compliance & Record Keeping",
      description:
        "Meet educational compliance requirements with secure archival, audit trails, and formatted documentation ready for actokenation reviews.",
      iconName: "LuShield",
    },
    {
      title: "Multi-Campus Support",
      description:
        "Centralized documentation across multiple campuses and departments with role-based access and administrative oversight capabilities.",
      iconName: "LuLibrary",
    },
    {
      title: "Educational Pricing",
      description:
        "Special volume pricing for educational institutions with flexible licensing options for faculty, staff, and administrative teams.",
      iconName: "LuDollarSign",
    },
  ],
  pricing: {
    header: "Educational Institution Pricing",
    subtitle: "Special rates and packages designed for schools and universities",
  },
  letter: {
    targetPersona: "Educational Administrator",
  },
  finalCta: {
    headline: "Transform Your Institution's Meeting Documentation",
    buttonText: "Request Educational Pricing",
  },
  seo: {
    title: "GovClerkMinutes for Schools: Educational Meeting Minutes Solution",
    description:
      "Meeting documentation software for schools, colleges, and universities. Streamline faculty meetings, board sessions, and administrative documentation with AI-powered transcription.",
    keywords:
      "Education, School Meeting Minutes, University Documentation, Faculty Meetings, Academic Administration, Educational Software, School Board Minutes",
    canonical: "https://GovClerkMinutes.com/enterprise/schools",
  },
};
