import {
  Box,
  Container,
  Heading,
  Link,
  ListItem,
  Text,
  VStack,
  UnorderedList,
} from "@chakra-ui/react";
import ReactMarkdown from "react-markdown";
import { assertString } from "@/utils/assert";
import Image from "next/image";
import { BlogPost } from "@/blog/blogUtils";
import { CtaSection } from "@/components/landing/GovClerk/GovClerkCtaSection";

type Props = BlogPost;

function parseImageUri(uri: string):
  | {
      alt: string;
      width: number;
      height: number;
    }
  | undefined {
  const basename = /.*\/([^/]+)$/.exec(uri)?.[1];
  if (basename == null) {
    return undefined;
  }
  const dimensions = /.*-([0-9]+x[0-9]+)\.[a-zA-Z]+$/.exec(uri)?.[1];
  const dims = dimensions?.split("x");
  if (dims == null) {
    return undefined;
  }
  const [width, height] = dims.map((dim) => parseInt(dim));
  const alt = basename.split("-").slice(0, -1).join(" ");
  return {
    alt,
    width,
    height,
  };
}

export const BlogArticle = (props: Props) => {
  const { title, description, author, date, imgUri } = props.data;

  const headerIds = props.content
    .split("\n")
    .filter((line) => line.trim().startsWith("#"))
    .map((line) => line.split(" ").slice(1).join("-"));

  const headerImgData = parseImageUri(imgUri);

  const markdownComponents = {
    h1: ({ node, ...props }: any) => {
      const id = assertString(props?.children?.[0]).split(" ").join("-");
      return (
        <Heading
          as="h1"
          fontSize={{ base: "2xl", md: "4xl" }}
          fontWeight="normal"
          fontFamily="Georgia, serif"
          color="gray.800"
          pt={8}
          pb={4}
          id={id}
          {...props}
        />
      );
    },
    h2: ({ node, ...props }: any) => {
      const id = assertString(props?.children?.[0]).split(" ").join("-");
      return (
        <Heading
          as="h2"
          fontSize={{ base: "xl", md: "3xl" }}
          fontWeight="semibold"
          color="gray.800"
          pt={6}
          pb={3}
          id={id}
          {...props}
        />
      );
    },
    h3: ({ node, ...props }: any) => {
      const id = assertString(props?.children?.[0]).split(" ").join("-");
      return (
        <Heading
          as="h3"
          fontSize={{ base: "lg", md: "2xl" }}
          fontWeight="semibold"
          color="gray.800"
          pt={5}
          pb={2}
          id={id}
          {...props}
        />
      );
    },
    h4: ({ node, ...props }: any) => {
      const id = assertString(props?.children?.[0]).split(" ").join("-");
      return (
        <Heading
          as="h4"
          fontSize={{ base: "md", md: "xl" }}
          fontWeight="semibold"
          color="gray.800"
          pt={4}
          pb={2}
          id={id}
          {...props}
        />
      );
    },
    h5: (props: any) => (
      <Heading
        as="h5"
        fontSize="lg"
        fontWeight="semibold"
        color="gray.800"
        pt={3}
        pb={2}
        {...props}
      />
    ),
    h6: (props: any) => (
      <Heading
        as="h6"
        fontSize="md"
        fontWeight="semibold"
        color="gray.800"
        pt={3}
        pb={2}
        {...props}
      />
    ),
    p: (props: any) => (
      <Text as="p" py={3} lineHeight="tall" fontSize="lg" color="gray.700" {...props} />
    ),
    img: (props: any) => {
      if (props.src == null) {
        return null;
      }
      const imgData = parseImageUri(props.src);
      if (imgData == null) {
        return null;
      }
      return (
        <Box py={4}>
          <Image
            src={props.src}
            alt={imgData.alt}
            width={imgData.width}
            height={imgData.height}
            style={{ margin: "auto", borderRadius: "12px" }}
          />
        </Box>
      );
    },
    blockquote: (props: any) => (
      <Box
        as="blockquote"
        borderLeft="4px solid"
        borderColor="blue.400"
        bg="blue.50"
        pl={4}
        py={3}
        my={4}
        borderRadius="md"
        fontStyle="italic"
        color="gray.700"
        {...props}
      />
    ),
    li: ({ node, ordered, ...props }: any) => (
      <ListItem {...props} fontSize="lg" color="gray.700" ml={4} />
    ),
  };

  return (
    <Box as="article" py={{ base: 16, md: 24 }} bg="white">
      <Container maxW="5xl">
        <VStack spacing={{ base: 8, md: 12 }} align="stretch">
          <VStack spacing={6} textAlign="center">
            <Text
              fontSize="sm"
              fontWeight="semibold"
              textTransform="uppercase"
              letterSpacing="wide"
              color="blue.600"
            >
              {new Date(date).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </Text>

            <Heading
              as="h1"
              fontSize={{ base: "3xl", md: "5xl" }}
              fontWeight="normal"
              fontFamily="Georgia, serif"
              color="gray.800"
              maxW="4xl"
              lineHeight="1.2"
            >
              {title}
            </Heading>

            <Text fontSize={{ base: "lg", md: "xl" }} color="gray.600" maxW="3xl">
              {description}
            </Text>

            <Text fontSize="sm" color="gray.500">
              By {author}
            </Text>
          </VStack>

          {headerImgData && (
            <Box
              borderRadius="2xl"
              overflow="hidden"
              position="relative"
              w="full"
              h={{ base: "300px", md: "500px" }}
            >
              <Image
                src={imgUri}
                alt={headerImgData.alt}
                fill
                style={{ objectFit: "cover" }}
                priority
              />
            </Box>
          )}

          <Box display="flex" flexDirection={{ base: "column", lg: "row" }} gap={8}>
            <Box flex="1" maxW="100%">
              <Box
                sx={{
                  "& > *": {
                    maxWidth: "100%",
                  },
                }}
              >
                <ReactMarkdown components={markdownComponents} skipHtml>
                  {props.content}
                </ReactMarkdown>
              </Box>
            </Box>

            <Box display={{ base: "none", lg: "block" }} minW="200px" maxW="200px">
              <Box
                position="sticky"
                top="100px"
                bg="rgba(239, 246, 255, 0.4)"
                backdropFilter="blur(12px)"
                borderRadius="lg"
                border="1px solid"
                borderColor="rgba(59, 130, 246, 0.2)"
                p={4}
              >
                <Heading
                  as="h4"
                  fontSize="xs"
                  fontWeight="semibold"
                  textTransform="uppercase"
                  letterSpacing="wide"
                  color="gray.600"
                  mb={3}
                >
                  Contents
                </Heading>
                <UnorderedList listStyleType="none" m={0} spacing={1.5}>
                  {headerIds.map((id, idx) => (
                    <ListItem key={idx}>
                      <Link
                        href={`#${id}`}
                        fontSize="xs"
                        color="gray.700"
                        fontWeight="medium"
                        _hover={{ color: "blue.600", textDecoration: "none" }}
                        transition="color 0.2s"
                        noOfLines={2}
                      >
                        {id.split("-").join(" ")}
                      </Link>
                    </ListItem>
                  ))}
                </UnorderedList>
              </Box>
            </Box>
          </Box>
        </VStack>
      </Container>

      <CtaSection />
    </Box>
  );
};
