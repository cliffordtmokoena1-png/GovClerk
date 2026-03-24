import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import MgHead from "@/components/MgHead";
import LandingPage from "@/components/landing/LandingPage";
import TemplateLandingPage from "@/components/landing/TemplateLandingPage";
import { LandingPageContent } from "@/types/landingPage";
import { getPersonalizationFromCookies } from "@/utils/landing/landingUtils";

type Props = Readonly<{
  content: LandingPageContent;
}>;

export default function LandingPageWrapper({ content }: Props) {
  const router = useRouter();
  const [country, setCountry] = useState<string | null>(null);

  const isMainLandingPage = router.pathname === "/";

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
      {isMainLandingPage ? (
        <LandingPage country={country} />
      ) : (
        <TemplateLandingPage content={content} country={country} />
      )}
    </>
  );
}
