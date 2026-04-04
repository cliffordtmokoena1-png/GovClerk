import React from "react";
import { Box, Badge, Heading, Text, Flex } from "@chakra-ui/react";

type Props = {
  badge: string;
  heading: string;
  subtitle: string;
};

export default function HeroBanner({ badge, heading, subtitle }: Props) {
  return (
    <Box
      w="full"
      bg="linear-gradient(135deg, #152a4e 0%, #1a3260 60%, #1e40af 100%)"
      px={{ base: 4, md: 8 }}
      py={{ base: 3, md: 4 }}
      flexShrink={0}
    >
      <Flex direction="column" align="center" maxW="2xl" mx="auto" gap={2}>
        <Badge
          colorScheme="blue"
          bg="whiteAlpha.200"
          color="white"
          fontSize="xs"
          px={3}
          py={1}
          borderRadius="full"
          letterSpacing="wide"
          textTransform="uppercase"
        >
          {badge}
        </Badge>
        <Heading
          size={{ base: "md", md: "lg" }}
          fontWeight="bold"
          color="white"
          textAlign="center"
          letterSpacing="tight"
        >
          {heading}
        </Heading>
        <Text fontSize={{ base: "sm", md: "md" }} color="whiteAlpha.800" textAlign="center">
          {subtitle}
        </Text>
      </Flex>
    </Box>
  );
}
