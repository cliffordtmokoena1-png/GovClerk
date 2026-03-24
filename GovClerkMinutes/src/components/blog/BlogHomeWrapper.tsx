import { Box } from "@chakra-ui/react";
import MgHead from "@/components/MgHead";
import { NavBar } from "@/components/landing/NavBar";
import { Footer } from "@/components/landing/Footer";
import { BlogCardList } from "./BlogCardList";
import { GradientBackground } from "@/components/GradientBackground";
import { BlogPost } from "@/blog/blogUtils";

type Props = Readonly<{
  blogPosts: BlogPost[];
}>;

export default function BlogHomeWrapper({ blogPosts }: Props) {
  return (
    <>
      <MgHead
        title="Blog | GovClerkMinutes"
        description="Blog insights, ideas, and inspiration for meeting minutes."
      />
      <Box position="relative" minH="100vh">
        <Box position="fixed" inset={0}>
          <GradientBackground />
        </Box>

        <Box position="relative" zIndex={1}>
          <NavBar />
          <BlogCardList blogPosts={blogPosts} />
          <Footer />
        </Box>
      </Box>
    </>
  );
}
