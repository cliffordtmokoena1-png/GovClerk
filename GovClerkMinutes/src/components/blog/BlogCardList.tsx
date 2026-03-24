import { Box, Container, Heading, Text, VStack, Grid } from "@chakra-ui/react";
import { BlogPost } from "@/blog/blogUtils";
import { BlogCard } from "./BlogCard";

type Props = {
  blogPosts: BlogPost[];
};

export const BlogCardList = ({ blogPosts }: Props) => {
  const blogPostsSorted = blogPosts.sort((a, b) => {
    return new Date(b.data.date).getTime() - new Date(a.data.date).getTime();
  });

  return (
    <Box as="section" py={{ base: 16, md: 24 }} bg="white">
      <Container maxW="7xl">
        <VStack spacing={{ base: 8, md: 12 }}>
          <VStack spacing={4} textAlign="center" maxW="3xl">
            <Text
              fontSize="sm"
              fontWeight="semibold"
              textTransform="uppercase"
              letterSpacing="wide"
              color="blue.600"
            >
              Blog
            </Text>
            <Heading
              as="h1"
              fontSize={{ base: "3xl", md: "5xl" }}
              fontWeight="normal"
              fontFamily="Georgia, serif"
              color="gray.800"
            >
              Latest Insights & Articles
            </Heading>
            <Text fontSize={{ base: "lg", md: "xl" }} color="gray.600">
              Discover tips, best practices, and insights about meeting minutes, productivity, and
              AI transcription.
            </Text>
          </VStack>

          <Grid
            templateColumns={{ base: "1fr", md: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" }}
            gap={8}
            w="full"
          >
            {blogPostsSorted.map((post, idx) => (
              <BlogCard key={idx} {...post.data} />
            ))}
          </Grid>
        </VStack>
      </Container>
    </Box>
  );
};
