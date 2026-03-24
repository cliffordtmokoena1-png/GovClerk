import React from "react";
import { Box, Flex, Text, Image, Link, VStack, HStack, Badge } from "@chakra-ui/react";
import { HiGlobeAlt } from "react-icons/hi2";
import { PortalSettings } from "@/types/portal";

type Props = {
  settings: PortalSettings | null;
};

export default function PortalPreview({ settings }: Props) {
  const headerBgColor = settings?.headerBgColor || "#1a365d";
  const headerTextColor = settings?.headerTextColor || "#ffffff";
  const accentColor = settings?.accentColor || "#3182ce";
  const title = settings?.pageTitle || "Your Portal Title";
  const description = settings?.pageDescription || "Portal description will appear here";
  const navLinks = settings?.navLinks || [];
  const logoUrl = settings?.logoUrl;
  const isEnabled = settings?.isEnabled ?? false;

  return (
    <Box bg="white" borderRadius="lg" boxShadow="sm" overflow="hidden" position="sticky" top={6}>
      <Flex
        justify="space-between"
        align="center"
        px={4}
        py={2}
        bg="gray.100"
        borderBottom="1px solid"
        borderColor="gray.200"
      >
        <Text fontSize="sm" fontWeight="medium" color="gray.600">
          Preview
        </Text>
        <Badge colorScheme={isEnabled ? "green" : "gray"} fontSize="xs">
          {isEnabled ? "Published" : "Draft"}
        </Badge>
      </Flex>

      <Box
        transform="scale(0.85)"
        transformOrigin="top left"
        width="117.6%"
        maxH="500px"
        overflow="hidden"
      >
        {/* Header Preview */}
        <Box bg={headerBgColor} px={4} py={4}>
          <Flex justify="space-between" align="center" maxW="container.lg" mx="auto">
            <HStack spacing={3}>
              {logoUrl ? (
                <Image src={logoUrl} alt="Logo" maxH="40px" maxW="120px" objectFit="contain" />
              ) : (
                <Flex
                  w="40px"
                  h="40px"
                  bg="whiteAlpha.200"
                  borderRadius="md"
                  align="center"
                  justify="center"
                >
                  <HiGlobeAlt size={20} color={headerTextColor} />
                </Flex>
              )}
              <Text color={headerTextColor} fontWeight="semibold" fontSize="lg">
                {title}
              </Text>
            </HStack>

            {navLinks.length > 0 && (
              <HStack spacing={4} display={{ base: "none", sm: "flex" }}>
                {navLinks.slice(0, 3).map((link, index) => (
                  <Link
                    key={index}
                    color={headerTextColor}
                    fontSize="sm"
                    opacity={0.9}
                    _hover={{ opacity: 1 }}
                  >
                    {link.label || "Link"}
                  </Link>
                ))}
              </HStack>
            )}
          </Flex>
        </Box>

        {/* Content Preview */}
        <Box bg="gray.50" px={4} py={6}>
          <VStack align="start" spacing={4} maxW="container.lg" mx="auto">
            <Text color="gray.600" fontSize="sm">
              {description}
            </Text>

            {/* Meeting Cards Preview */}
            <VStack spacing={3} w="full" align="stretch">
              {[1, 2, 3].map((i) => (
                <Box
                  key={i}
                  bg="white"
                  borderRadius="md"
                  p={4}
                  boxShadow="sm"
                  borderLeft="4px solid"
                  borderLeftColor={accentColor}
                >
                  <Text fontWeight="medium" color="gray.800" fontSize="sm">
                    Sample Meeting {i}
                  </Text>
                  <Text color="gray.500" fontSize="xs" mt={1}>
                    January {i + 10}, 2024 • 2:00 PM
                  </Text>
                  <HStack mt={2} spacing={2}>
                    <Badge
                      bg={accentColor}
                      color="white"
                      fontSize="xs"
                      px={2}
                      py={0.5}
                      borderRadius="sm"
                    >
                      Minutes
                    </Badge>
                    <Badge
                      variant="outline"
                      colorScheme="gray"
                      fontSize="xs"
                      px={2}
                      py={0.5}
                      borderRadius="sm"
                    >
                      Agenda
                    </Badge>
                  </HStack>
                </Box>
              ))}
            </VStack>
          </VStack>
        </Box>
      </Box>

      {settings?.slug && (
        <Box px={4} py={3} bg="gray.50" borderTop="1px solid" borderColor="gray.200">
          <Text fontSize="xs" color="gray.500">
            Portal URL:{" "}
            <Link href={`/portal/${settings.slug}`} color="blue.500" isExternal fontWeight="medium">
              /portal/{settings.slug}
            </Link>
          </Text>
        </Box>
      )}
    </Box>
  );
}
