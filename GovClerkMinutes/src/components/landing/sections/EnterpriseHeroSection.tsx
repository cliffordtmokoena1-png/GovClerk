import React from "react";
import { Box, Container, Heading, Text, HStack, Icon, VStack, Badge, Grid } from "@chakra-ui/react";
import Image from "next/image";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/router";
import { FaStar } from "react-icons/fa";
import { safeCapture } from "@/utils/safePosthog";
import QuoteRequestForm from "@/components/landing/QuoteRequestForm";

interface EnterpriseHeroSectionProps {
  title: string;
  subtitle: string;
  subheadline: string;
  image: string;
  mobileImage: string;
  country: string | null;
}

const StarRating = ({ size }: { size: number }) => (
  <HStack spacing={1} color="yellow.400">
    {[...Array(5)].map((_, i) => (
      <Icon key={i} as={FaStar} boxSize={size} />
    ))}
  </HStack>
);

export const EnterpriseHeroSection = ({
  title,
  subtitle,
  subheadline,
  image,
  mobileImage,
  country,
}: EnterpriseHeroSectionProps) => {
  const router = useRouter();
  const { isLoaded, userId } = useAuth();

  const badgeStyles = {
    px: 4,
    py: 2,
    borderRadius: "full",
    bg: "rgba(255, 255, 255, 0.9)",
    backdropFilter: "blur(12px)",
    border: "1px solid",
    borderColor: "blue.100",
    fontWeight: "medium",
    color: "gray.700",
    textTransform: "none" as const,
  };

  return (
    <Box
      as="section"
      position="relative"
      minH="100vh"
      display="flex"
      alignItems="center"
      pt={{ base: 24, md: 32 }}
      pb={{ base: 16, md: 24 }}
      onMouseEnter={() => {
        safeCapture("new_landing_page_section_seen", {
          section: "hero",
          variant: "enterprise",
        });
      }}
      overflow="hidden"
    >
      {/* Background */}
      <Box
        position="absolute"
        top={0}
        left={0}
        right={0}
        bottom={0}
        bg="white"
      />

      <Container maxW="7xl" position="relative" zIndex={1}>
        {/* Mobile: Vertical Stack */}
        <VStack spacing={{ base: 6, md: 0 }} display={{ base: "flex", md: "none" }}>
          {/* Content */}
          <VStack spacing={4} textAlign="center" w="full">
            <Heading
              as="h1"
              fontSize={{ base: "3xl", sm: "4xl" }}
              lineHeight="1.4"
              fontWeight="normal"
              fontFamily="Georgia, serif"
              color="gray.700"
              mt={6}
            >
              <Box as="span" display="inline">
                {title}
              </Box>
            </Heading>

            <Heading
              as="h2"
              fontSize={{ base: "2xl", sm: "3xl" }}
              lineHeight="1.4"
              fontWeight="normal"
              fontFamily="Georgia, serif"
              color="gray.700"
            >
              <Box as="span" bg="yellow.100" px={3} py={1} borderRadius="md">
                in seconds
              </Box>
              ,{" "}
              <Box as="span" color="gray.400" textDecoration="line-through">
                not hours
              </Box>
            </Heading>

            <Text fontSize="md" color="gray.600" lineHeight="1.8">
              {subtitle}
            </Text>

            <Badge
              {...badgeStyles}
              fontSize="xs"
              textAlign="center"
              display="flex"
              flexDirection="column"
              alignItems="center"
              gap={2}
            >
              <HStack spacing={1} color="yellow.400" justify="center">
                {[...new Array(5)].map((_, i) => (
                  <Icon key={`mobile-star-${i}`} as={FaStar} boxSize={3} />
                ))}
              </HStack>
              <Box>{subheadline}</Box>
            </Badge>
          </VStack>

          {/* Mobile Screenshot */}
          <Box maxW="600px" mx="auto" borderRadius="2xl" overflow="hidden" w="full">
            <Image
              src="/screenshots/mobile-v2.png"
              alt="GovClerkMinutes Mobile Dashboard"
              width={600}
              height={800}
              style={{ width: "100%", height: "auto" }}
            />
          </Box>

          {/* Form - Last on Mobile */}
          <QuoteRequestForm
            country={country ?? "US"}
            heading="Book a Demo"
            subtext="Fill out the form and we'll schedule a personalized demo at your convenience."
            buttonText="BOOK A DEMO"
            successTitle="Demo request received!"
            successMessage="We'll reach out shortly to schedule your personalized demo."
            formType="demo"
          />
        </VStack>

        {/* Desktop: 2-Column Layout (60% / 40%) */}
        <Grid
          templateColumns="60% 40%"
          gap={12}
          display={{ base: "none", md: "grid" }}
          alignItems="start"
          px={8}
        >
          {/* Left Column: Content */}
          <VStack spacing={6} align="center" textAlign="center" pr={8}>
            <Heading
              as="h1"
              fontSize="clamp(1.425rem, 3.8vw, 2.375rem)"
              lineHeight="1.1"
              fontWeight="normal"
              fontFamily="Georgia, serif"
              color="gray.700"
              mt={6}
            >
              {title}
            </Heading>

            <Heading
              as="h2"
              fontSize="clamp(1.425rem, 3.8vw, 2.375rem)"
              lineHeight="1.1"
              fontWeight="normal"
              fontFamily="Georgia, serif"
              color="gray.700"
              mt={0}
            >
              <Box as="span" bg="yellow.100" px={3} py={1} borderRadius="md">
                in seconds
              </Box>
              ,{" "}
              <Box as="span" color="gray.400" textDecoration="line-through">
                not hours
              </Box>
            </Heading>

            <Text fontSize="clamp(0.95rem, 1.425vw, 1.19rem)" color="gray.600" lineHeight="1.8">
              {subtitle}
            </Text>

            <Badge
              {...badgeStyles}
              fontSize="clamp(0.71rem, 1.14vw, 0.83rem)"
              display="flex"
              alignItems="center"
              gap={2}
              alignSelf="center"
              mb={8}
            >
              <StarRating size={4} />
              {subheadline}
            </Badge>

            {/* Desktop Screenshot */}
            <Box maxW="1200px" overflow="hidden" w="full" mt={0}>
              <Image
                src="/screenshots/desktop-v2.png"
                alt="GovClerkMinutes Desktop Dashboard"
                width={1200}
                height={800}
                style={{ width: "100%", height: "auto" }}
              />
            </Box>
          </VStack>

          {/* Right Column: Form */}
          <Box position="sticky" top="20px" px={4}>
            <QuoteRequestForm
              country={country ?? "US"}
              heading="Book a Demo"
              subtext="Fill out the form and we'll schedule a personalized demo at your convenience."
              buttonText="BOOK A DEMO"
              successTitle="Demo request received!"
              successMessage="We'll reach out shortly to schedule your personalized demo."
              formType="demo"
            />
          </Box>
        </Grid>
      </Container>
    </Box>
  );
};
