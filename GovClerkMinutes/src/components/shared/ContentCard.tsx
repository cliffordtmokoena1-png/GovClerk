import React, { ReactNode } from "react";
import { Box, Flex, Icon, Text } from "@chakra-ui/react";
import { IconType } from "react-icons";

type Props = {
  children: ReactNode;
  icon?: IconType;
  title?: string;
};

export default function ContentCard({ children, icon, title }: Props) {
  return (
    <Box
      bg="white"
      borderRadius="xl"
      boxShadow="0 2px 16px rgba(21,42,78,0.10)"
      border="1px solid"
      borderColor="gray.100"
      overflow="hidden"
      w="full"
    >
      {(icon || title) && (
        <Box px={6} py={4} borderBottom="1px solid" borderColor="gray.100" bg="gray.50">
          <Flex align="center" gap={2}>
            {icon && <Icon as={icon} color="#1e40af" boxSize={4} />}
            {title && (
              <Text fontWeight="semibold" color="gray.700" fontSize="sm">
                {title}
              </Text>
            )}
          </Flex>
        </Box>
      )}
      {children}
    </Box>
  );
}
