import type { GetStaticProps } from "next";
import MgHead from "@/components/MgHead";
import EnterpriseTemplateLandingPage from "@/components/landing/EnterpriseTemplateLandingPage";
import { LandingPageContent } from "@/types/landingPage";
import { loadContent } from "@/components/landing/pseo/config";
import { useState, useEffect } from "react";
import { getPersonalizationFromCookies } from "@/utils/landing/landingUtils";
import { isDev } from "@/utils/dev";

type Props = {
  content: LandingPageContent;
};

export const getStaticProps: GetStaticProps<Props> = async () => {
  // Gate enterprise pages to development mode only
  if (!isDev()) {
    return {
      notFound: true,
    };
  }

  const content = await loadContent("enterprise-schools");

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
};

export default function EnterpriseSchoolsPage({ content }: Props) {
  const [country, setCountry] = useState<string | null>(null);

  useEffect(() => {
    const { country } = getPersonalizationFromCookies();
    setCountry(country);
  }, []);

  return (
    <>
      <MgHead
        title={content.seo.title}
        description={content.seo.description}
        canonical={content.seo.canonical}
        keywords={content.seo.keywords}
      />
      <EnterpriseTemplateLandingPage content={content} country={country} />
    </>
  );
}
