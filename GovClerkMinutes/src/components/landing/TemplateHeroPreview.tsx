import React from "react";
import { Box } from "@chakra-ui/react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";

type Props = {
  content: string;
};

const commonBoxStyles = {
  position: "relative" as const,
  w: "full",
  maxW: "100%",
  bg: "white",
  border: "1px solid",
  borderColor: "gray.300",
  borderRadius: "4px",
  overflow: "hidden",
  boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
  userSelect: "none" as const,
  sx: {
    "*": {
      userSelect: "none",
      pointerEvents: "none",
    },
  },
};

const gradientBg = {
  position: "absolute" as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  bg: "linear-gradient(to bottom, #fafafa 0%, #ffffff 100%)",
};

const baseContentStyles = {
  position: "relative" as const,
  fontFamily: "system-ui, -apple-system, sans-serif",
  color: "gray.700",
  overflow: "hidden",
  h: "full",
  opacity: 0.85,
  textAlign: "left" as const,
};

const fadeGradient = (height: string, opacity: number) => ({
  position: "absolute" as const,
  bottom: 0,
  left: 0,
  right: 0,
  h: height,
  bgGradient: `linear(to-t, rgba(255,255,255,${opacity}), transparent)`,
  pointerEvents: "none" as const,
});

export default function TemplateHeroPreview({ content }: Props) {
  return (
    <>
      <Box {...commonBoxStyles} display={{ base: "none", lg: "block" }} aspectRatio="8.5/4.4">
        <Box {...gradientBg} />
        <Box
          {...baseContentStyles}
          p="96px"
          fontSize="16px"
          lineHeight="1.6"
          sx={{
            "& h1, & h2, & h3": {
              fontSize: "20px",
              fontWeight: "bold",
              marginBottom: "12px",
              marginTop: "10px",
              textAlign: "left",
            },
            "& p": {
              fontSize: "16px",
              marginBottom: "10px",
              textAlign: "left",
            },
            "& ul, & ol": {
              fontSize: "16px",
              marginLeft: "24px",
              marginBottom: "10px",
            },
            "& li": {
              fontSize: "16px",
              marginBottom: "6px",
            },
            "& strong": {
              fontWeight: "600",
            },
          }}
        >
          <ReactMarkdown remarkPlugins={[remarkBreaks]}>{content}</ReactMarkdown>
        </Box>
        <Box {...fadeGradient("60px", 0.95)} />
      </Box>

      <Box {...commonBoxStyles} display={{ base: "block", lg: "none" }} aspectRatio="8.5/11">
        <Box {...gradientBg} />
        <Box
          {...baseContentStyles}
          padding="12vw"
          fontSize="1.8vw"
          lineHeight="1.4"
          sx={{
            "& h1, & h2, & h3": {
              fontSize: "2.1vw",
              fontWeight: "bold",
              marginBottom: "0.6vw",
              marginTop: "0.4vw",
              textAlign: "left",
            },
            "& p": {
              fontSize: "1.8vw",
              marginBottom: "0.5vw",
              textAlign: "left",
            },
            "& ul, & ol": {
              fontSize: "1.8vw",
              marginLeft: "2vw",
              marginBottom: "0.5vw",
            },
            "& li": {
              fontSize: "1.8vw",
              marginBottom: "0.2vw",
            },
            "& strong": {
              fontWeight: "600",
            },
          }}
        >
          <ReactMarkdown remarkPlugins={[remarkBreaks]}>{content}</ReactMarkdown>
        </Box>
        <Box {...fadeGradient("40px", 0.9)} />
      </Box>
    </>
  );
}
