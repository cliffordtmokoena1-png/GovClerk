/**
 * Content schema for templatable landing pages
 * Enables programmatic SEO and content customization based on target audience, industry, etc.
 * Uses string identifiers for icons to maintain serializability for static generation
 */
export interface LandingPageContent {
  /**
   * Hero section content
   */
  hero: {
    /** Main title with customizable category (e.g., "Create [category] minutes in seconds") */
    title: string;

    /** Subtitle with customizable meeting type (e.g., "Upload a [meeting type] and get instant summaries") */
    subtitle: string;

    /** Subheadline targeting specific personas/industries (e.g., "Perfect for [persona]s and [industry] professionals") */
    subheadline: string;

    /** Path to hero/demo image - can be swapped for category-specific versions */
    image: string;

    /** Mobile version of hero/demo image */
    mobileImage: string;

    /** Optional: Template preview content for template showcase pages */
    templatePreview?: string;
  };

  /**
   * Feature cards content
   * Can be filtered/prioritized based on relevant features per template
   */
  features: Array<{
    /** Feature title */
    title: string;

    /** Feature description */
    description: string;

    /** Icon name string identifier (maps to actual icon component) */
    iconName: string;
  }>;

  /**
   * Optional custom heading for features section
   */
  featuresHeading?: {
    /** Main heading text */
    title: string;

    /** Subtitle text */
    subtitle: string;
  };

  /**
   * Testimonial section content
   * Can be filtered by industry, persona, etc.
   */
  testimonials: Array<{
    /** Testimonial quote */
    quote: string;

    /** Author name */
    author: string;

    /** Author role/company */
    role: string;

    /** Optional path to author image */
    image?: string;

    /** If true, uses initials instead of image */
    useInitials?: boolean;

    /** Initials to display if useInitials is true */
    initials?: string;
  }>;

  /**
   * FAQ section content
   * Can be customized with category-specific questions
   */
  faqs: Array<{
    /** Question */
    q: string;

    /** Answer */
    a: string;
  }>;

  /**
   * Pricing section content
   * Can be customized for specific personas/roles
   */
  pricing: {
    /** Header text (e.g., "How much are [lawyer] hours worth?") */
    header: string;

    /** Subtitle text targeting specific personas (e.g., "[Admins] do a lot. Buy back your time...") */
    subtitle: string;
  };

  /**
   * Letter section content (CEO letter)
   * Can be customized for different target personas
   */
  letter: {
    /** Greeting target persona (e.g., "Administrative Professional", "Legal Professional") */
    targetPersona: string;
  };

  /**
   * Final CTA section content
   */
  finalCta: {
    /** Headline with customizable category (e.g., "Start generating better [category] minutes today") */
    headline: string;

    /** CTA button text */
    buttonText: string;
  };

  /**
   * SEO metadata
   */
  seo: {
    /** Page title - dynamically generated based on meeting type and user role */
    title: string;

    /** Meta description */
    description: string;

    /** Additional keywords */
    keywords?: string;

    /** Canonical URL for SEO */
    canonical?: string;
  };
}
