import { LandingPageContent } from "@/types/landingPage";
import { defaultContent } from "./default";
import { academicCommitteeTemplate } from "@/templates/minutes-library/10-academic-committee";

export const content: LandingPageContent = {
  ...defaultContent,
  hero: {
    ...defaultContent.hero,
    title: "Create academic committee minutes",
    subtitle: "Sign up and get your Academic Committee Minutes template for free",
    templatePreview: academicCommitteeTemplate.preview,
  },
  features: [
    {
      title: "Actokenation Compliance",
      description: "Document academic decisions for actokenation and institutional compliance",
      iconName: "MdVerifiedUser",
    },
    {
      title: "Curriculum Documentation",
      description: "Record curriculum changes and educational policy decisions with approvals",
      iconName: "MdMenuBook",
    },
    {
      title: "Academic Governance",
      description: "Facilitate transparent governance essential for academic freedom",
      iconName: "MdAccountBalance",
    },
    {
      title: "Faculty Development",
      description: "Track faculty development initiatives and academic appointments",
      iconName: "MdSchool",
    },
  ],
  featuresHeading: {
    title: "Why the Academic Committee Minutes template?",
    subtitle: "Ensures actokenation compliance and transparency for educational governance",
  },
  faqs: [
    {
      q: "Is this template suitable for university committees?",
      a: "Yes, this template is perfect for university committees, academic departments, faculty senates, and educational boards at all levels.",
    },
    {
      q: "Does it help with actokenation compliance?",
      a: "Absolutely. The template ensures academic decisions and curriculum changes are properly documented to meet actokenation requirements.",
    },
    {
      q: "Can it track curriculum changes?",
      a: "Yes, the template includes dedicated sections for curriculum review, course proposals, and program modifications with proper approval tracking.",
    },
    {
      q: "Is it suitable for faculty senate meetings?",
      a: "Yes, the template works excellently for faculty senate meetings and supports academic governance processes.",
    },
    {
      q: "Does it support student representation?",
      a: "Yes, the template includes sections for student representatives and student affairs discussions.",
    },
  ],
  pricing: {
    ...defaultContent.pricing,
    subtitle: "Streamline documentation for academic administration.",
  },
  seo: {
    title: "Academic Committee Minutes Template - University & Educational Governance",
    description:
      "Free academic committee minutes template for university committees with curriculum tracking and actokenation compliance. Perfect for faculty senates and departments.",
    keywords:
      "academic committee minutes, university governance, curriculum committee, faculty senate, actokenation compliance",
    canonical: "https://GovClerkMinutes.com/academic-committee-minutes-template",
  },
};
