import { Flex, Heading, SimpleGrid } from "@chakra-ui/react";
import BlogCard from "./BlogCard";
import { BlogPost } from "@/blog/blogUtils";

type Props = {
  blogPosts: BlogPost[];
};

const BlogCardList = ({ blogPosts }: Props) => {
  const blogPostsSorted = blogPosts.sort((a, b) => {
    return new Date(b.data.date).getTime() - new Date(a.data.date).getTime();
  });

  return (
    <Flex
      direction="column"
      w="full"
      alignItems="center"
      textAlign={{ base: "center", lg: "left" }}
    >
      <Flex
        direction={{ base: "column", lg: "row" }}
        px={{ base: 4, sm: 6, lg: 8 }}
        pt={10}
        pb={5}
        maxW="7xl"
        alignItems="center"
      >
        <Flex direction="column" w="full" alignItems="center">
          <Heading as="h1" size="sm" pb={3}>
            Blog
          </Heading>
          <Heading size="xl" color="darkblue" pb={10} maxW="3xl" textAlign="center">
            Latest articles about meeting minute generation
          </Heading>
          <Heading size="md">Blog insights, ideas, and inspiration for meeting minutes.</Heading>
          <SimpleGrid columns={{ base: 1, lg: 3 }} spacing={10} pt={10}>
            {blogPostsSorted.map((post, idx) => (
              <BlogCard key={idx} {...post.data} />
            ))}
          </SimpleGrid>
        </Flex>
      </Flex>
    </Flex>
  );
};

export default BlogCardList;
