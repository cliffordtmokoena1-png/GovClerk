import { Box, Heading, Text, VStack } from "@chakra-ui/react";
import Image from "next/image";
import Link from "next/link";
import { LuArrowRight } from "react-icons/lu";
import { BlogPostMetadata } from "@/blog/blogUtils";

export const BlogCard = ({ title, description, date, slug, imgUri }: BlogPostMetadata) => {
  return (
    <Link href={`/blog/${slug}`} passHref style={{ textDecoration: "none" }}>
      <Box
        borderRadius="xl"
        overflow="hidden"
        bg="rgba(255, 255, 255, 0.8)"
        backdropFilter="blur(12px)"
        border="1px solid"
        borderColor="rgba(59, 130, 246, 0.2)"
        transition="all 0.3s"
        h="full"
        display="flex"
        flexDirection="column"
        _hover={{
          "@media (hover: hover)": {
            borderColor: "rgba(59, 130, 246, 0.4)",
            boxShadow: "xl",
            transform: "translateY(-4px)",
          },
        }}
      >
        <Box position="relative" w="full" h="220px" overflow="hidden">
          <Image
            src={imgUri}
            alt={title}
            fill
            style={{ objectFit: "cover" }}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        </Box>

        <VStack align="start" spacing={3} p={6} flex="1">
          <Text fontSize="sm" color="blue.600" fontWeight="medium">
            {new Date(date).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </Text>

          <Heading
            as="h3"
            fontSize={{ base: "lg", md: "xl" }}
            fontWeight="semibold"
            color="gray.900"
            lineHeight="1.4"
            noOfLines={2}
          >
            {title}
          </Heading>

          <Text color="gray.600" fontSize="sm" noOfLines={3} flex="1">
            {description}
          </Text>

          <Text
            fontSize="sm"
            color="blue.500"
            fontWeight="medium"
            pt={2}
            display="flex"
            alignItems="center"
            gap={1}
          >
            Read more <LuArrowRight size={14} />
          </Text>
        </VStack>
      </Box>
    </Link>
  );
};
