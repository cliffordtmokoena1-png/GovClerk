import React from "react";
import { Flex, Spinner, Text } from "@chakra-ui/react";

interface ContentSpinnerProps {
  readonly message?: string;
}

export function ContentSpinner({ message = "Loading..." }: Readonly<ContentSpinnerProps>) {
  return (
    <Flex
      alignItems="center"
      justifyContent="center"
      h="full"
      w="full"
      flexDirection="column"
      gap={4}
    >
      <Spinner thickness="4px" speed="0.65s" emptyColor="gray.200" color="blue.500" size="xl" />
      <Text color="gray.600" fontSize="sm">
        {message}
      </Text>
    </Flex>
  );
}

export default ContentSpinner;
