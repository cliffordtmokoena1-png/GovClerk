import React from "react";
import { Box } from "@chakra-ui/react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";

type DocumentPreviewProps = {
  content: string;
  variant: "thumbnail" | "card";
};

const MARKDOWN_STYLES = {
  thumbnail: {
    fontSize: "4px",
    padding: 1.5,
    sx: {
      "& h1, & h2, & h3": {
        fontSize: "5px",
        fontWeight: "bold",
        marginBottom: "1px",
      },
      "& p": {
        fontSize: "4px",
        marginBottom: "1px",
      },
      "& ul, & ol": {
        fontSize: "4px",
        marginLeft: "4px",
        marginBottom: "1px",
      },
      "& li": {
        fontSize: "4px",
        marginBottom: "0.5px",
      },
      "& strong": {
        fontWeight: "600",
      },
    },
  },
  card: {
    fontSize: "7px",
    padding: 3,
    sx: {
      "& h1, & h2, & h3": {
        fontSize: "8px",
        fontWeight: "bold",
        marginBottom: "2px",
      },
      "& p": {
        fontSize: "7px",
        marginBottom: "2px",
      },
      "& ul, & ol": {
        fontSize: "7px",
        marginLeft: "6px",
        marginBottom: "2px",
      },
      "& li": {
        fontSize: "7px",
        marginBottom: "1px",
      },
      "& strong": {
        fontWeight: "600",
      },
    },
  },
};

export function DocumentPreview({ content, variant }: DocumentPreviewProps) {
  const styles = MARKDOWN_STYLES[variant];

  return (
    <Box
      position="relative"
      p={styles.padding}
      fontSize={styles.fontSize}
      fontFamily="system-ui, -apple-system, sans-serif"
      color="gray.700"
      lineHeight="1.4"
      overflow="hidden"
      h="full"
      opacity={0.7}
      sx={styles.sx}
    >
      <ReactMarkdown remarkPlugins={[remarkBreaks]}>{content}</ReactMarkdown>
    </Box>
  );
}
