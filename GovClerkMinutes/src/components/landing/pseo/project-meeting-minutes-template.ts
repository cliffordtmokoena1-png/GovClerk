import { LandingPageContent } from "@/types/landingPage";
import { defaultContent } from "./default";
import { projectMeetingTemplate } from "@/templates/minutes-library/04-project-meeting";

export const content: LandingPageContent = {
  ...defaultContent,
  hero: {
    ...defaultContent.hero,
    title: "Create project meeting minutes",
    subtitle: "Sign up and get your Project Meeting Minutes template for free",
    templatePreview: projectMeetingTemplate.preview,
  },
  features: [
    {
      title: "Milestone Tracking",
      description: "Track project health metrics and milestone progress for timeline adherence",
      iconName: "MdTimeline",
    },
    {
      title: "Resource Management",
      description: "Document resource allocation, dependencies, and blockers for coordination",
      iconName: "MdGroups",
    },
    {
      title: "Budget Monitoring",
      description: "Maintain detailed budget discussion records for accurate cost management",
      iconName: "MdAttachMoney",
    },
    {
      title: "Risk Documentation",
      description: "Capture risks early with mitigation strategies and responsible owners",
      iconName: "MdWarning",
    },
  ],
  featuresHeading: {
    title: "Why the Project Meeting Minutes template?",
    subtitle: "Track deliverables, milestones, risks, and team coordination",
  },
  faqs: [
    {
      q: "What makes this template ideal for project managers?",
      a: "This template includes dedicated sections for milestone tracking, resource allocation, risk management, and budget monitoring - all the key elements project managers need to track.",
    },
    {
      q: "Can I track multiple work packages with this template?",
      a: "Yes! The template is designed to handle complex projects with multiple work packages, dependencies, and parallel workstreams.",
    },
    {
      q: "Does it help with stakeholder communication?",
      a: "Absolutely. The structured format makes it easy to extract status updates and create reports for stakeholders and leadership.",
    },
    {
      q: "How does it handle risk management?",
      a: "The template includes dedicated sections for identifying risks, documenting mitigation strategies, and assigning risk owners.",
    },
    {
      q: "Is this suitable for agile projects?",
      a: "Yes, while comprehensive, the template can be adapted for agile methodologies and sprint planning meetings.",
    },
  ],
  pricing: {
    ...defaultContent.pricing,
    subtitle: "Stay organized and keep projects on track.",
  },
  seo: {
    title: "Project Meeting Minutes Template - Track Milestones & Deliverables",
    description:
      "Free project meeting minutes template with milestone tracking, resource management, and risk documentation. Perfect for project managers and teams.",
    keywords:
      "project meeting minutes, milestone tracking, project management, deliverables, risk management",
    canonical: "https://GovClerkMinutes.com/project-meeting-minutes-template",
  },
};
