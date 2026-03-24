import React from "react";
import { Box, Heading, Text, VStack, Code } from "@chakra-ui/react";

type Props = Readonly<{
  sourceText: string;
  title: string | null;
}>;

export default function AgendaSourceController({ sourceText, title }: Props) {
  return (
    <VStack
      align="stretch"
      spacing={4}
      h="100%"
      p={6}
      bg="gray.50"
      borderRight="1px"
      borderColor="gray.200"
      overflowY="auto"
    >
      <Box>
        <Heading size="sm" mb={2} color="gray.600">
          Meeting Context
        </Heading>
        {title && (
          <Text fontSize="md" fontWeight="semibold" mb={4}>
            {title}
          </Text>
        )}
      </Box>

      <Box
        flex={1}
        bg="white"
        p={4}
        borderRadius="md"
        border="1px"
        borderColor="gray.200"
        whiteSpace="pre-wrap"
        fontFamily="mono"
        fontSize="sm"
        lineHeight="tall"
      >
        <Code
          display="block"
          whiteSpace="pre-wrap"
          bg="transparent"
          p={0}
          fontSize="sm"
          color="gray.800"
        >
          {sourceText}
        </Code>
      </Box>
    </VStack>
  );
}
