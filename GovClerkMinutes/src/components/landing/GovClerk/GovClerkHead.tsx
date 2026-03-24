import Head from "next/head";
import { faqData } from "./faqData";

type Props = {
  title?: string;
  description?: string;
  canonical?: string;
  noindex?: boolean;
};

export default function GovClerkHead({ title, description, canonical, noindex }: Props) {
  const defaultTitle = "GovClerk | AI-Powered Meeting Management for Government & Organizations";
  const defaultDescription =
    "Automate agendas, meeting minutes, transcription, and public records for government bodies, school boards, and organizations. AI-powered meeting management that saves hours on every meeting.";
  const resolvedTitle = title || defaultTitle;
  const resolvedDescription = description || defaultDescription;
  const resolvedCanonical = canonical || "https://GovClerk.com/";
  const ogImageUrl = "/screenshots/desktop-v2.png";

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqData.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  const softwareJsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "GovClerk",
    applicationCategory: "BusinessApplication",
    description: resolvedDescription,
    url: "https://GovClerk.com",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      description: "Contact us for pricing",
    },
    operatingSystem: "Web",
  };

  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "GovClerk",
    url: "https://GovClerk.com",
    logo: "https://GovClerk.com/govclerk-icon.svg",
    description:
      "AI-powered meeting management platform for government bodies, school boards, and public organizations.",
    sameAs: ["https://linkedin.com/company/GovClerk", "https://twitter.com/GovClerk"],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "sales",
      url: "https://GovClerk.com/",
    },
  };

  return (
    <Head>
      <title>{resolvedTitle}</title>
      {noindex && <meta name="robots" content="noindex" />}
      <meta charSet="UTF-8" />

      <link rel="icon" href="/govclerk-icon.svg" type="image/svg+xml" />
      <link rel="manifest" href="/manifest.json" />
      <link rel="canonical" href={resolvedCanonical} />

      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta name="description" content={resolvedDescription} />
      <meta
        name="keywords"
        content="government meeting management software, AI meeting minutes, agenda management, board meeting software, municipal meeting minutes, public meeting portal, meeting transcription software, GovClerk, open meeting compliance"
      />
      <meta name="author" content="GovClerk" />

      <meta property="og:type" content="website" />
      <meta property="og:url" content={resolvedCanonical} />
      <meta property="og:title" content={resolvedTitle} />
      <meta property="og:description" content={resolvedDescription} />
      <meta property="og:image" content={ogImageUrl} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:site_name" content="GovClerk" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={resolvedCanonical} />
      <meta name="twitter:title" content={resolvedTitle} />
      <meta name="twitter:description" content={resolvedDescription} />
      <meta name="twitter:image" content={ogImageUrl} />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(softwareJsonLd),
        }}
      />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqJsonLd),
        }}
      />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(organizationJsonLd),
        }}
      />
    </Head>
  );
}
