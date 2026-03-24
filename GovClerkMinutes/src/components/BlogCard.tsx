import { BlogPost, BlogPostMetadata } from "@/blog/blogUtils";
import { Flex, Heading, Text } from "@chakra-ui/react";
import Image from "next/image"; // Import Next.js Image component
import Link from "next/link"; // Import Next.js Link component

type Props = BlogPostMetadata;

const BlogCard = ({ title, description, author, date, slug, imgUri }: Props) => {
  return (
    <Link href={`/blog/${slug}`} passHref style={{ overflow: "hidden", borderRadius: "0.375rem" }}>
      <Flex
        flexDirection="column"
        gap={5}
        _hover={{
          transform: "scale(1.05)",
        }}
        transition="transform 0.15s"
        p={4}
      >
        <Image
          src={imgUri}
          alt={title}
          width={500}
          height={300}
          style={{ borderRadius: "0.375rem", margin: "auto" }}
        />
        <Text>{date}</Text>
        <Heading size="md">{title}</Heading>
      </Flex>
    </Link>
  );
};

export default BlogCard;
