import { Box } from "@chakra-ui/react";
import MgHead from "@/components/MgHead";
import { NavBar } from "@/components/landing/NavBar";
import { Footer } from "@/components/landing/Footer";
import { BlogArticle } from "./BlogArticle";
import { GradientBackground } from "@/components/GradientBackground";
import { BlogPost } from "@/blog/blogUtils";

type Props = BlogPost & {
  emailSubmitted: boolean;
  onEmailSubmitted: () => void;
};

export default function BlogArticleWrapper(props: Props) {
  const { emailSubmitted, onEmailSubmitted, ...blogPost } = props;

  return (
    <>
      <MgHead
        title={blogPost.data.title}
        description={blogPost.data.description}
        image={blogPost.data.imgUri}
      />
      <Box position="relative" minH="100vh">
        <Box position="fixed" inset={0}>
          <GradientBackground />
        </Box>

        <Box position="relative" zIndex={1}>
          <NavBar />
          <BlogArticle {...blogPost} />
          <Footer />
        </Box>
      </Box>
    </>
  );
}
