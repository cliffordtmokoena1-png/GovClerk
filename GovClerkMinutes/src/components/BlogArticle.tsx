import { Box, Flex, Heading, Link, ListItem, Text, UnorderedList } from "@chakra-ui/react";
import ReactMarkdown from "react-markdown";
import { assertString } from "@/utils/assert";
import Image from "next/image";
import { BlogPost } from "@/blog/blogUtils";

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

const BlogArticle = (props: Props) => {
  const { title, description, author, date, imgUri } = props.data;

  const headerIds = props.content
    .split("\n")
    .filter((line) => line.trim().startsWith("#"))
    .map((line) => line.split(" ").slice(1).join("-"));

  const headerImgData = parseImageUri(imgUri);

  const markdownComponents = {
    h1: ({ node, ...props }: any) => {
      const id = assertString(props?.children?.[0]).split(" ").join("-");
      return <Heading as="h1" size="2xl" color="darkblue" py={5} id={id} {...props} />;
    },
    h2: ({ node, ...props }: any) => {
      const id = assertString(props?.children?.[0]).split(" ").join("-");
      return <Heading as="h2" size="xl" py={5} id={id} {...props} />;
    },
    h3: ({ node, ...props }: any) => {
      const id = assertString(props?.children?.[0]).split(" ").join("-");
      return <Heading as="h3" size="lg" py={5} id={id} {...props} />;
    },
    h4: ({ node, ...props }: any) => {
      const id = assertString(props?.children?.[0]).split(" ").join("-");
      return <Heading as="h4" size="md" py={5} id={id} {...props} />;
    },
    h5: (props: any) => <Heading as="h5" size="sm" py={5} {...props} />,
    h6: (props: any) => <Heading as="h6" size="xs" py={5} {...props} />,
    p: (props: any) => <Text as="p" py={3} lineHeight={8} fontSize="lg" {...props} />,
    img: (props: any) => {
      if (props.src == null) {
        return null;
      }
      const headerImgData = parseImageUri(props.src);
      if (headerImgData == null) {
        return null;
      }
      return (
        <Image
          src={props.src}
          alt={headerImgData.alt}
          width={headerImgData.width}
          height={headerImgData.height}
          style={{ margin: "auto" }}
        />
      );
    },
    blockquote: (props: any) => (
      <Box
        as="blockquote"
        borderLeft="solid 4px"
        borderColor="gray.300"
        pl={2}
        mt={1}
        ml={2}
        {...props}
      />
    ),
    li: ({ node, ordered, ...props }: any) => (
      <ListItem {...props} fontWeight="semibold" fontSize="sm" />
    ),
  };

  return (
    <Flex
      w="full"
      p={2}
      flexDirection="column"
      alignSelf="center"
      px={{ base: 4, sm: 6, lg: 8 }}
      maxW="7xl"
    >
      <Heading
        as="h1"
        size="2xl"
        color="darkblue"
        pt={5}
        textAlign="center"
        w={{ base: "full", lg: "70%" }}
      >
        {title}
      </Heading>
      <Text textAlign="center" fontWeight="semibold" pt={8} w={{ base: "full", lg: "70%" }}>
        By {author} · {date}
      </Text>
      <Text
        as="p"
        py={8}
        lineHeight={8}
        fontSize="lg"
        textAlign="center"
        w={{ base: "full", lg: "70%" }}
      >
        {description}
      </Text>
      <Flex w="full" flexDirection={{ base: "column", lg: "row-reverse" }}>
        {/* Table of contents */}
        <Flex
          w={{ base: "full", lg: "30%" }}
          pl={{ base: 0, lg: 10 }}
          pb={{ base: 10, lg: 0 }}
          justifyContent="center"
          h="fit-content"
          position={{ base: "relative", lg: "sticky" }}
          top={{ base: 0, lg: 32 }}
        >
          <aside>
            <nav>
              <Flex
                flexDirection="column"
                w="full"
                border="1px"
                borderColor="gray.300"
                color="gray.600"
                px={4}
              >
                <Heading
                  as="h4"
                  size="sm"
                  py={3}
                  color="gray.400"
                  css={{
                    "font-variant-caps": "small-caps",
                  }}
                >
                  table of contents
                </Heading>
                <UnorderedList m={0}>
                  {headerIds.map((id, idx) => {
                    return (
                      <ListItem
                        key={idx}
                        listStyleType="none"
                        fontWeight="semibold"
                        py={2}
                        fontSize="sm"
                      >
                        <Link href={`#${id}`} _hover={{ textDecoration: "underline" }}>
                          {id.split("-").join(" ")}
                        </Link>
                      </ListItem>
                    );
                  })}
                </UnorderedList>
              </Flex>
            </nav>
          </aside>
        </Flex>
        <Flex flexDirection="column" w={{ base: "full", lg: "70%" }}>
          {headerImgData && (
            <Flex justifyContent="center" pb={5}>
              <Image
                src={imgUri}
                alt={headerImgData.alt}
                width={headerImgData.width}
                height={headerImgData.height}
              />
            </Flex>
          )}
          <ReactMarkdown components={markdownComponents} skipHtml>
            {props.content}
          </ReactMarkdown>
        </Flex>
      </Flex>
    </Flex>
  );
};

export default BlogArticle;
