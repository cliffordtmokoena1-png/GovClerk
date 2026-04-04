import { Box, Text, Button, VStack, Heading } from "@chakra-ui/react";
import Link from "next/link";

export function BlogCtaBanner() {
  return (
    <Box
      bg="blue.50"
      borderLeft="4px solid"
      borderColor="blue.500"
      borderRadius="lg"
      p={6}
      my={8}
    >
      <VStack align="start" spacing={4}>
        <Heading as="h3" fontSize={{ base: "lg", md: "xl" }} color="gray.800">
          Generate Your Meeting Minutes in Seconds
        </Heading>
        <Text color="gray.600">
          Stop spending hours on manual meeting minutes. Let AI do the work.
        </Text>
        <Button as={Link} href="/sign-up" colorScheme="orange" size="lg">
          Try Free — No Credit Card Required
        </Button>
      </VStack>
    </Box>
  );
}
