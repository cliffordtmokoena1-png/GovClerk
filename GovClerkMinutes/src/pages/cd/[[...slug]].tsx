import Link from "next/link";
import { useRouter } from "next/router";

// These imports are updated to match your actual folder: src/components/landing/GovClerk/
import GovClerkLandingPage from "@/components/landing/GovClerk/sections/GovClerkLandingPage";
import GovClerkPageLayout from "@/components/landing/GovClerk/sections/GovClerkPageLayout";
import GovClerkHead from "@/components/landing/GovClerk/GovClerkHead";
import GovClerkSubPageHero from "@/components/landing/GovClerk/sections/GovClerkSubPageHero";
import GovClerkFeatureDetailSection from "@/components/landing/GovClerk/sections/GovClerkFeatureDetailSection";
import GovClerkCtaSection from "@/components/landing/GovClerk/sections/GovClerkCtaSection";
import { findPageBySlug } from "@/components/landing/GovClerk/sections/GovClerkPages";

export default function GovClerkCatchAll() {
  const router = useRouter();
  const slugParts = router.query.slug;

  // Hydration check to prevent layout shift
  if (!router.isReady) {
    return (
      <GovClerkPageLayout>
        <div className="min-h-[60vh]" />
      </GovClerkPageLayout>
    );
  }

  // Handle the root /cd path
  if (!slugParts || slugParts.length === 0) {
    return <GovClerkLandingPage />;
  }

  const slug = Array.isArray(slugParts) ? slugParts.join("/") : slugParts;
  const pageData = findPageBySlug(slug);

  // 404 Fallback
  if (!pageData) {
    return (
      <GovClerkPageLayout>
        <GovClerkHead
          title="Page Not Found | GovClerk"
          description="The page you are looking for does not exist."
          noindex
        />
        <div className="flex min-h-[60vh] items-center justify-center px-6">
          <div className="text-center">
            <h1 className="font-serif text-4xl font-normal text-gray-800 md:text-5xl">
              Page Not Found
            </h1>
            <p className="mt-4 text-lg text-gray-600">
              The page you are looking for does not exist or has been moved.
            </p>
            <Link
              href="/"
              className="mt-8 inline-block rounded-lg bg-cd-blue px-8 py-3 text-base font-semibold text-white transition-all hover:bg-cd-blue-dark hover:shadow-md"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </GovClerkPageLayout>
    );
  }

  // Dynamic Page Rendering
  return (
    <GovClerkPageLayout>
      <GovClerkHead
        title={pageData.seo.title}
        description={pageData.seo.description}
        canonical={`https://GovClerk.com/${pageData.slug}`}
      />
      <GovClerkSubPageHero
        label={pageData.hero.label}
        title={pageData.hero.title}
        description={pageData.hero.description}
        imageUrl={pageData.hero.imageUrl}
      />
      {pageData.features.length > 0 && (
        <GovClerkFeatureDetailSection features={pageData.features} />
      )}
      <GovClerkCtaSection />
    </GovClerkPageLayout>
  );
}