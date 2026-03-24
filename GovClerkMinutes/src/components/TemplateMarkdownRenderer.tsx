import React from "react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import { Heading, Text, ListItem, UnorderedList, OrderedList } from "@chakra-ui/react";

type TemplateMarkdownRendererProps = {
  content: string;
  variant?: "modal" | "drawer";
};

export function TemplateMarkdownRenderer({
  content,
  variant = "modal",
}: TemplateMarkdownRendererProps) {
  const isDrawer = variant === "drawer";

  return (
    <ReactMarkdown
      remarkPlugins={[remarkBreaks]}
      components={{
        h1: ({ node, ...props }) => (
          <Heading as="h1" size={isDrawer ? "sm" : "md"} mb={isDrawer ? 1 : 2} {...props} />
        ),
        h2: ({ node, ...props }) => <Heading as="h2" size="xs" mb={isDrawer ? 1 : 2} {...props} />,
        h3: ({ node, ...props }) => <Heading as="h3" fontSize="xs" mb={1} {...props} />,
        p: ({ node, ...props }) => (
          <Text mb={isDrawer ? 1 : 2} fontSize={isDrawer ? "xs" : "sm"} {...props} />
        ),
        ul: ({ node, ...props }) => (
          <UnorderedList
            ml={isDrawer ? 3 : 4}
            mb={isDrawer ? 1 : 2}
            fontSize={isDrawer ? "xs" : "sm"}
            {...props}
          />
        ),
        ol: ({ node, ...props }) => (
          <OrderedList
            ml={isDrawer ? 3 : 4}
            mb={isDrawer ? 1 : 2}
            fontSize={isDrawer ? "xs" : "sm"}
            {...props}
          />
        ),
        li: ({ node, ...props }) => <ListItem mb={isDrawer ? 0.5 : 1} {...props} />,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
