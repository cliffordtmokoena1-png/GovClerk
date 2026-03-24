import { LandingPageContent } from "@/types/landingPage";
import { defaultContent } from "./default";
import { teamHuddleTemplate } from "@/templates/minutes-library/05-team-huddle";

export const content: LandingPageContent = {
  ...defaultContent,
  hero: {
    ...defaultContent.hero,
    title: "Create team huddle minutes",
    subtitle: "Sign up and get your Team Huddle Minutes template for free",
    templatePreview: teamHuddleTemplate.preview,
  },
  features: [
    {
      title: "Brief & Focused Format",
      description: "Track yesterday's progress, today's goals, and blockers efficiently",
      iconName: "MdSpeed",
    },
    {
      title: "Transparent Communication",
      description: "Facilitate open team communication and accountability with clear objectives",
      iconName: "MdVisibility",
    },
    {
      title: "Blocker Identification",
      description: "Quickly identify obstacles and support needs for prompt resolution",
      iconName: "MdBlock",
    },
    {
      title: "Agile-Friendly",
      description: "Perfect for daily standups, sprint check-ins, and agile synchronization",
      iconName: "MdLoop",
    },
  ],
  featuresHeading: {
    title: "Why the Team Huddle Minutes template?",
    subtitle: "Quick format for daily standups and team sync meetings",
  },
  faqs: [
    {
      q: "Is this template suitable for daily standups?",
      a: "Yes! This template is specifically designed for daily standups and quick team sync meetings. It keeps meetings brief and focused on what matters.",
    },
    {
      q: "Can it be used for remote teams?",
      a: "Absolutely. The template works great for both in-person and remote team huddles, maintaining team connection and accountability regardless of location.",
    },
    {
      q: "How does it help identify blockers?",
      a: "The template has a dedicated section for each team member to report blockers, making it easy to identify issues that need immediate attention.",
    },
    {
      q: "Is this agile-friendly?",
      a: "Yes, the template follows agile standup best practices and works perfectly for scrum teams and sprint check-ins.",
    },
    {
      q: "Does it track team mood?",
      a: "Yes, the template includes sections for capturing team energy and sentiment, helping managers identify when team members need support.",
    },
  ],
  pricing: {
    ...defaultContent.pricing,
    subtitle: "Keep your team aligned with efficient daily syncs.",
  },
  seo: {
    title: "Team Huddle Minutes Template - Daily Standup & Sync Meetings",
    description:
      "Free team huddle minutes template for daily standups and quick sync meetings. Track progress, blockers, and team mood efficiently.",
    keywords:
      "team huddle minutes, daily standup, scrum standup, team sync, agile meetings, sprint checkin",
    canonical: "https://GovClerkMinutes.com/team-huddle-minutes-template",
  },
};
