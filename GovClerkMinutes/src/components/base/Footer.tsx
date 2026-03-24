import React from "react";
import {
  Box,
  Container,
  SimpleGrid,
  Stack,
  Text,
  Link as ChakraLink,
  useColorModeValue,
  Image,
  ButtonGroup,
  IconButton,
} from "@chakra-ui/react";
import Link from "next/link";
import { FaTwitter, FaGithub, FaLinkedin } from "react-icons/fa";
import { getAllSlugs } from "@/utils/landing/landingUtils";
import IconWordmark from "@/components/IconWordmark";


const ListHeader = ({ children }: { children: React.ReactNode }) => {
  return (
    <Text fontWeight="500" fontSize="lg" mb={2}>
      {children}
    </Text>
  );
};

export const Footer = () => {
  const borderColor = useColorModeValue("gray.200", "gray.700");
  const slugs = getAllSlugs();

  const formatSlugForDisplay = (slug: string): string => {
    return slug
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const footerContent = (
    <Box color={useColorModeValue("gray.700", "gray.200")}>
      <Container as={Stack} maxW="container.xl" py={8} px={{ base: 6, md: 8 }}>
        <SimpleGrid columns={{ base: 1, sm: 2, md: 5 }} spacing={8}>
          <Stack align="flex-start">
            <ListHeader>Product</ListHeader>
            <ChakraLink as={Link} href="/pricing">
              Pricing
            </ChakraLink>
            <ChakraLink as={Link} href="/blog">
              Blog
            </ChakraLink>
            <ChakraLink as={Link} href="/dashboard">
              Dashboard
            </ChakraLink>
          </Stack>

          <Stack align="flex-start">
            <ListHeader>Company</ListHeader>
            <ChakraLink as={Link} href="/">
              About Us
            </ChakraLink>
            <ChakraLink as={Link} href="/contact">Contact Us</ChakraLink>
            <ChakraLink href="https://www.linkedin.com/company/GovClerkMinutes" isExternal>
              Careers
            </ChakraLink>
          </Stack>

          <Stack align="flex-start">
            <ListHeader>Legal</ListHeader>
            <ChakraLink as={Link} href="/privacy-policy.html" isExternal>
              Privacy Policy
            </ChakraLink>
            <ChakraLink as={Link} href="/terms-of-use.html" isExternal>
              Terms of Use
            </ChakraLink>
            <ChakraLink as={Link} href="/privacy-policy.html" isExternal>
              Data Deletion
            </ChakraLink>
          </Stack>

          <Stack align="flex-start">
            <ListHeader>Meeting Minutes</ListHeader>
            {slugs.map((slug) => (
              <ChakraLink key={slug} as={Link} href={`/${slug}`}>
                {formatSlugForDisplay(slug)}
              </ChakraLink>
            ))}
          </Stack>

          <Stack align="flex-start">
            <ListHeader>Follow Us</ListHeader>
            <ButtonGroup variant="ghost">
              <IconButton
                as="a"
                href="https://twitter.com/GovClerkMinutes"
                aria-label="Twitter"
                icon={<FaTwitter fontSize="20px" />}
              />
              <IconButton
                as="a"
                href="https://github.com/GovClerkMinutes"
                aria-label="GitHub"
                icon={<FaGithub fontSize="20px" />}
              />
              <IconButton
                as="a"
                href="https://linkedin.com/company/GovClerkMinutes"
                aria-label="LinkedIn"
                icon={<FaLinkedin fontSize="20px" />}
              />
            </ButtonGroup>
          </Stack>
        </SimpleGrid>

        <Box pt={8}>
          <Stack
            direction={{ base: "column", md: "row" }}
            spacing={6}
            align="center"
            justify="space-between"
            borderTop="1px"
            borderColor={borderColor}
            pt={8}
          >
            <ChakraLink as={Link} href="/" display="flex" alignItems="center">
              <IconWordmark variant="whiteWordmark" />
            </ChakraLink>
            <Text fontSize="sm">
              {new Date().getFullYear()} GovClerkMinutes. All rights reserved.
            </Text>
          </Stack>
        </Box>
      </Container>
    </Box>
  );

  return (
    <Box
      maxW="7xl"
      mx="auto"
      w="full"
      bg="gray.50"
      borderRadius="2xl"
      border="1px solid"
      borderColor="gray.200"
      overflow="hidden"
    >
      {footerContent}
    </Box>
  );
};
