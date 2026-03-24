import React from "react";
import { Flex, Text, VStack, Icon as ChakraIcon } from "@chakra-ui/react";
import { HiWrenchScrewdriver } from "react-icons/hi2";
import { IconType } from "react-icons";

interface PlaceholderContentProps {
  readonly title: string;
  readonly icon?: IconType;
}

export function PlaceholderContent({
  title,
  icon: IconComponent = HiWrenchScrewdriver,
}: Readonly<PlaceholderContentProps>) {
  return (
    <Flex alignItems="center" justifyContent="center" h="full" w="full" bg="gray.50">
      <VStack spacing={4} textAlign="center" p={8}>
        <ChakraIcon as={IconComponent} boxSize={16} color="gray.400" />
        <VStack spacing={2}>
          <Text fontSize="2xl" fontWeight="bold" color="gray.700">
            {title}
          </Text>
          <Text fontSize="md" color="gray.500">
            This page is coming soon
          </Text>
        </VStack>
      </VStack>
    </Flex>
  );
}

export default PlaceholderContent;
