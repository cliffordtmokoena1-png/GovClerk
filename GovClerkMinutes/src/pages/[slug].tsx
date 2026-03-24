import type { GetStaticPaths, GetStaticProps } from "next";
import LandingPageWrapper from "@/components/landing/LandingPageWrapper";
import { LandingPageContent } from "@/types/landingPage";
import { getAllSlugs } from "@/utils/landing/landingUtils";
import { generateSlugBasedStaticProps } from "@/components/landing/pseo/config";

type Props = {
  content: LandingPageContent;
};

export const getStaticPaths: GetStaticPaths = async () => {
  const slugs = getAllSlugs();

  const paths = slugs.map((slug) => ({
    params: { slug },
  }));

  return {
    paths,
    fallback: false,
  };
};

export const getStaticProps: GetStaticProps<Props> = async (context) => {
  return generateSlugBasedStaticProps(context);
};

export default function DynamicLandingPage({ content }: Props) {
  return <LandingPageWrapper content={content} />;
}
