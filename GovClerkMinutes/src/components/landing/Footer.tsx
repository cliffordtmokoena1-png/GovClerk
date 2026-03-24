import {
  Box,
  Container,
  Grid,
  Heading,
  Text,
  VStack,
  HStack,
  Link as ChakraLink,
  Divider,
  IconButton,
  ButtonGroup,
} from "@chakra-ui/react";
import Link from "next/link";
import IconWordmark from "@/components/IconWordmark";
import { FaTwitter, FaGithub, FaLinkedin } from "react-icons/fa";
import { getAllSlugs } from "@/utils/landing/landingUtils";
import { isDev } from "@/utils/dev";

export const Footer = () => {
  const slugs = getAllSlugs();

  const formatSlugForDisplay = (slug: string): string => {
    return slug
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const formatUseCaseDisplay = (slug: string): string =>
    formatSlugForDisplay(slug)
      .replace(/\s*Template$/i, "")
      .replace(/\s*Meeting\s*Minutes?/i, "")
      .trim();

  const formatTemplateDisplay = (slug: string): string => {
    const formatted = formatSlugForDisplay(slug)
      .replace(/\s*Meeting\s*Minutes?\s*Template$/i, " Minutes")
      .replace(/\s*Template$/i, "");
    return (formatted.includes("Minutes") ? formatted : `${formatted} Minutes`).trim();
  };

  const templates = slugs.filter((slug) => slug.includes("template"));

  const useCases = slugs.filter((slug) => !templates.includes(slug));

  const productLinks = [
    { label: "Pricing", href: "/pricing" },
    { label: "Blog", href: "/blog" },
    { label: "Dashboard", href: "/dashboard" },
  ];

  const companyLinks = [
    { label: "About Us", href: "/" },
    { label: "Contact Us", href: "/contact" },
    {
      label: "Careers",
      href: "https://www.linkedin.com/company/GovClerkMinutes",
      isExternal: true,
    },
  ];

  const legalLinks = [
    { label: "Privacy Policy", href: "/privacy-policy.html", isExternal: true },
    { label: "Terms of Use", href: "/terms-of-use.html", isExternal: true },
    { label: "Data Deletion", href: "/legal/data-deletion-policy", isExternal: true },
  ];

  const enterpriseLinks = isDev()
    ? [
        { label: "Enterprise", href: "/enterprise" },
        { label: "Schools & Education", href: "/enterprise/schools" },
        { label: "Nonprofits", href: "/enterprise/nonprofits" },
      ]
    : [];

  return (
    <Box as="footer" bg="gray.800" color="white" pt={{ base: 12, md: 16 }} pb={8}>
      <Container maxW="7xl">
        <Grid templateColumns={{ base: "1fr", md: "1fr 2fr" }} gap={{ base: 8, md: 16 }} mb={12}>
          <VStack align="start" spacing={4}>
            <HStack spacing={2}>
              <IconWordmark variant="whiteWordmark" />
            </HStack>
            <Text color="gray.400" fontSize="sm" maxW="300px">
              AI-powered meeting minutes that save you hours every week. Transform recordings into
              professional minutes in seconds.
            </Text>
          </VStack>

          <VStack align="stretch" spacing={8}>
            <Grid
              templateColumns={{ base: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)" }}
              gap={8}
            >
              <VStack align="start" spacing={3}>
                <Heading
                  as="h3"
                  fontSize="sm"
                  fontWeight="semibold"
                  textTransform="uppercase"
                  letterSpacing="wide"
                >
                  Product
                </Heading>
                {productLinks.map((link) => (
                  <ChakraLink
                    key={link.href}
                    as={Link}
                    href={link.href}
                    color="gray.400"
                    fontSize="sm"
                    _hover={{ color: "white" }}
                    transition="color 0.2s"
                  >
                    {link.label}
                  </ChakraLink>
                ))}
              </VStack>

              <VStack align="start" spacing={3}>
                <Heading
                  as="h3"
                  fontSize="sm"
                  fontWeight="semibold"
                  textTransform="uppercase"
                  letterSpacing="wide"
                >
                  Company
                </Heading>
                {companyLinks.map((link) => (
                  <ChakraLink
                    key={link.href}
                    {...(link.isExternal
                      ? { href: link.href, isExternal: true }
                      : { as: Link, href: link.href })}
                    color="gray.400"
                    fontSize="sm"
                    _hover={{ color: "white" }}
                    transition="color 0.2s"
                  >
                    {link.label}
                  </ChakraLink>
                ))}
              </VStack>

              <VStack align="start" spacing={3}>
                <Heading
                  as="h3"
                  fontSize="sm"
                  fontWeight="semibold"
                  textTransform="uppercase"
                  letterSpacing="wide"
                >
                  Legal
                </Heading>
                {legalLinks.map((link) => (
                  <ChakraLink
                    key={link.href}
                    as={Link}
                    href={link.href}
                    color="gray.400"
                    fontSize="sm"
                    _hover={{ color: "white" }}
                    transition="color 0.2s"
                    isExternal={link.isExternal}
                  >
                    {link.label}
                  </ChakraLink>
                ))}
              </VStack>
            </Grid>

            <Grid
              templateColumns={{ base: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)" }}
              gap={8}
            >
              <VStack align="start" spacing={3}>
                <Heading
                  as="h3"
                  fontSize="sm"
                  fontWeight="semibold"
                  textTransform="uppercase"
                  letterSpacing="wide"
                >
                  Use Cases
                </Heading>
                {useCases.map((slug) => (
                  <ChakraLink
                    key={slug}
                    as={Link}
                    href={`/${slug}`}
                    color="gray.400"
                    fontSize="sm"
                    _hover={{ color: "white" }}
                    transition="color 0.2s"
                  >
                    {formatUseCaseDisplay(slug)}
                  </ChakraLink>
                ))}
              </VStack>

              <VStack align="start" spacing={3}>
                <Heading
                  as="h3"
                  fontSize="sm"
                  fontWeight="semibold"
                  textTransform="uppercase"
                  letterSpacing="wide"
                >
                  Templates
                </Heading>
                {templates.map((slug) => (
                  <ChakraLink
                    key={slug}
                    as={Link}
                    href={`/${slug}`}
                    color="gray.400"
                    fontSize="sm"
                    _hover={{ color: "white" }}
                    transition="color 0.2s"
                  >
                    {formatTemplateDisplay(slug)}
                  </ChakraLink>
                ))}
              </VStack>

              {enterpriseLinks.length > 0 && (
                <VStack align="start" spacing={3}>
                  <Heading
                    as="h3"
                    fontSize="sm"
                    fontWeight="semibold"
                    textTransform="uppercase"
                    letterSpacing="wide"
                  >
                    Enterprise
                  </Heading>
                  {enterpriseLinks.map((link) => (
                    <ChakraLink
                      key={link.href}
                      as={Link}
                      href={link.href}
                      color="gray.400"
                      fontSize="sm"
                      _hover={{ color: "white" }}
                      transition="color 0.2s"
                    >
                      {link.label}
                    </ChakraLink>
                  ))}
                </VStack>
              )}
            </Grid>
          </VStack>
        </Grid>

        <Divider borderColor="gray.700" mb={8} />

        <HStack
          justify="space-between"
          flexDirection={{ base: "column", md: "row" }}
          spacing={{ base: 6, md: 0 }}
          align="center"
        >
          <Text color="gray.400" fontSize="sm">
            © {new Date().getFullYear()} GovClerkMinutes. All rights reserved.
          </Text>

          <ButtonGroup variant="ghost">
            <IconButton
              as="a"
              href="https://twitter.com/GovClerkMinutes"
              aria-label="Twitter"
              icon={<FaTwitter fontSize="20px" />}
              color="gray.400"
              _hover={{ color: "white" }}
            />
            <IconButton
              as="a"
              href="https://github.com/GovClerkMinutes"
              aria-label="GitHub"
              icon={<FaGithub fontSize="20px" />}
              color="gray.400"
              _hover={{ color: "white" }}
            />
            <IconButton
              as="a"
              href="https://linkedin.com/company/GovClerkMinutes"
              aria-label="LinkedIn"
              icon={<FaLinkedin fontSize="20px" />}
              color="gray.400"
              _hover={{ color: "white" }}
            />
          </ButtonGroup>
        </HStack>
      </Container>
    </Box>
  );
};
