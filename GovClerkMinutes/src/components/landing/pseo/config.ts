import type { GetStaticPropsResult, GetStaticPropsContext } from "next";
import { LandingPageContent } from "@/types/landingPage";

/**
 * Slug-to-Content Mapping for Dynamic Landing Pages
 *
 * Maps URL slugs to content identifiers for programmatic SEO pages.
 * This allows multiple slugs to share the same content while maintaining
 * unique URLs for SEO purposes.
 *
 * Mapping:
 *   - Key: URL slug
 *   - Value: Content identifier (matches a file in pseo/ directory)
 */
export const slugMap: Record<string, string> = {
  "minutes-of-the-meeting": "motm",
  "hoa-meeting-minutes": "hoa",
  "nonprofit-meeting-minutes": "nonprofit",
  "board-meeting-minutes": "board",
  "corporate-meeting-minutes": "corporate",
  "standard-meeting-minutes-template": "standard-meeting-minutes-template",
  "board-meeting-minutes-template": "board-meeting-minutes-template",
  "project-meeting-minutes-template": "project-meeting-minutes-template",
  "team-huddle-minutes-template": "team-huddle-minutes-template",
  "nonprofit-meeting-minutes-template": "nonprofit-meeting-minutes-template",
  "healthcare-meeting-minutes-template": "healthcare-meeting-minutes-template",
  "hr-meeting-minutes-template": "hr-meeting-minutes-template",
  "construction-meeting-minutes-template": "construction-meeting-minutes-template",
  "academic-committee-minutes-template": "academic-committee-minutes-template",
  "legal-meeting-minutes-template": "legal-meeting-minutes-template",
  "client-meeting-minutes-template": "client-meeting-minutes-template",
  "annual-general-meeting-minutes-template": "annual-general-meeting-minutes-template",
};

/**
 * Content loader mapping for PSEO pages
 * Maps content IDs to their respective content modules
 */
export const contentMap: Record<string, () => Promise<LandingPageContent>> = {
  default: async () => (await import("./default")).defaultContent,
  motm: async () => (await import("./motm")).content,
  hoa: async () => (await import("./hoa")).content,
  nonprofit: async () => (await import("./nonprofit")).content,
  board: async () => (await import("./board")).content,
  corporate: async () => (await import("./corporate")).content,
  enterprise: async () => (await import("./enterprise")).content,
  "enterprise-schools": async () => (await import("./enterprise-schools")).content,
  "enterprise-nonprofits": async () => (await import("./enterprise-nonprofits")).content,
  "standard-meeting-minutes-template": async () =>
    (await import("./standard-meeting-minutes-template")).content,
  "board-meeting-minutes-template": async () =>
    (await import("./board-meeting-minutes-template")).content,
  "project-meeting-minutes-template": async () =>
    (await import("./project-meeting-minutes-template")).content,
  "team-huddle-minutes-template": async () =>
    (await import("./team-huddle-minutes-template")).content,
  "nonprofit-meeting-minutes-template": async () =>
    (await import("./nonprofit-meeting-minutes-template")).content,
  "healthcare-meeting-minutes-template": async () =>
    (await import("./healthcare-meeting-minutes-template")).content,
  "hr-meeting-minutes-template": async () =>
    (await import("./hr-meeting-minutes-template")).content,
  "construction-meeting-minutes-template": async () =>
    (await import("./construction-meeting-minutes-template")).content,
  "academic-committee-minutes-template": async () =>
    (await import("./academic-committee-minutes-template")).content,
  "legal-meeting-minutes-template": async () =>
    (await import("./legal-meeting-minutes-template")).content,
  "client-meeting-minutes-template": async () =>
    (await import("./client-meeting-minutes-template")).content,
  "annual-general-meeting-minutes-template": async () =>
    (await import("./annual-general-meeting-minutes-template")).content,
};

/**
 * Load content for static props and runtime use
 */
export async function loadContent(contentId: string): Promise<LandingPageContent | null> {
  try {
    const loader = contentMap[contentId];
    if (!loader) {
      return null;
    }
    return await loader();
  } catch (error) {
    console.error(`Failed to load content for contentId: ${contentId}`, error);
    return null;
  }
}

type StaticPropsReturn = GetStaticPropsResult<{ content: LandingPageContent }>;

/**
 * Shared static props generator for landing pages
 * Loads content and returns standardized static props with error handling
 */
export async function generateLandingPageStaticProps(
  contentId: string
): Promise<StaticPropsReturn> {
  const content = await loadContent(contentId);

  if (!content) {
    return {
      notFound: true,
    };
  }

  return {
    props: {
      content,
    },
    revalidate: 3600,
  };
}

/**
 * Generate static props for slug-based pages
 * Extracts slug from context and loads corresponding content
 */
export async function generateSlugBasedStaticProps(
  context: GetStaticPropsContext
): Promise<StaticPropsReturn> {
  const slug = context.params?.slug as string;

  if (!slug) {
    return {
      notFound: true,
    };
  }

  // Get content ID from slug mapping
  const contentId = slugMap[slug] || null;

  if (!contentId) {
    return {
      notFound: true,
    };
  }

  return generateLandingPageStaticProps(contentId);
}
