import { Button, Flex, Heading, Text } from "@chakra-ui/react";

export default function Custom404() {
  return (
    <Flex
      flexDir="column"
      alignItems="center"
      justifyContent="center"
      h="100dvh"
      textAlign="center"
    >
      <Heading as="h1" size="2xl" mb="4">
        404 - Page Not Found
      </Heading>
      <Text fontSize="xl" mb="4">
        Sorry, the page you are looking for does not exist.
      </Text>
    </Flex>
  );
}
