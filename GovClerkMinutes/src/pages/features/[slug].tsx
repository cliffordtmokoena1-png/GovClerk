import { GetStaticPaths, GetStaticProps } from "next";
import { Box, Container, Heading, Text, VStack, Icon, Grid } from "@chakra-ui/react";
import { NavBar } from "@/components/landing/NavBar";
import { CtaSection } from "@/components/landing/GovClerk/GovClerkCtaSection";
import { Footer } from "@/components/landing/Footer";
import { GradientBackground } from "@/components/GradientBackground";
import MgHead from "@/components/MgHead";
import { FaqSection } from "@/components/landing/GovClerk/GovClerkFaqSection";
import { CompanyCarousel } from "@/components/landing/sections/CompanyCarousel";
import { TestimonialsSection } from "@/components/landing/GovClerk/GovClerkTestimonialsSection";
import { HowItWorksSection } from "@/components/landing/sections/HowItWorksSection";
import { LetterSection } from "@/components/landing/sections/LetterSection";
import { PricingSection } from "@/components/landing/sections/PricingSection";
import {
  featuresData,
  getFeatureBySlug,
  FeatureData,
  getFeatureIcon,
} from "@/components/landing/data/features";
import QuoteRequestForm from "@/components/landing/QuoteRequestForm";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/router";

interface FeaturePageProps {
  feature: FeatureData;
}

export default function FeaturePage({ feature }: FeaturePageProps) {
  const { title, description, iconName, layout, topCards = [], bottomCards = [] } = feature;
  const icon = getFeatureIcon(iconName);
  const { isLoaded, userId } = useAuth();
  const router = useRouter();

  const bottomCardsToShow = layout === "2+0" ? [] : bottomCards;

  return (
    <>
      <MgHead
        title={`${title} - GovClerkMinutes`}
        description={description}
        canonical={`https://GovClerkMinutes.com/features/${feature.slug}`}
        keywords={`meeting minutes, ${title.toLowerCase()}, transcription, ai minutes`}
      />

      <Box position="relative" minH="100vh">
        <Box position="fixed" inset={0}>
          <GradientBackground />
        </Box>

        <Box position="relative" zIndex={1}>
          <NavBar />

          {/* Hero Section */}
          <Box
            as="section"
            position="relative"
            pt={{ base: 24, md: 32 }}
            pb={{ base: 16, md: 24 }}
            overflow="hidden"
          >
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
              <VStack
                spacing={6}
                display={{ base: "flex", md: "none" }}
                textAlign="center"
                w="full"
              >
                <Box
                  bg="rgba(255, 255, 255, 0.9)"
                  backdropFilter="blur(12px)"
                  p={6}
                  borderRadius="2xl"
                  border="1px solid"
                  borderColor="blue.100"
                >
                  <Icon as={icon} boxSize={16} color="blue.600" />
                </Box>
                <Heading
                  as="h1"
                  fontSize={{ base: "3xl", sm: "4xl" }}
                  fontWeight="normal"
                  fontFamily="Georgia, serif"
                  color="gray.900"
                >
                  {title}
                </Heading>
                <Text fontSize="lg" color="gray.700">
                  {description}
                </Text>

                {/* Form - Last on Mobile */}
                <QuoteRequestForm country="US" />
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
                  <Box
                    bg="rgba(255, 255, 255, 0.9)"
                    backdropFilter="blur(12px)"
                    p={6}
                    borderRadius="2xl"
                    border="1px solid"
                    borderColor="blue.100"
                    display="inline-flex"
                  >
                    <Icon as={icon} boxSize={16} color="blue.600" />
                  </Box>
                  <Heading
                    as="h1"
                    fontSize="clamp(1.425rem, 3.8vw, 2.375rem)"
                    fontWeight="normal"
                    fontFamily="Georgia, serif"
                    color="gray.900"
                  >
                    {title}
                  </Heading>
                  <Text fontSize="clamp(0.95rem, 1.425vw, 1.19rem)" color="gray.700">
                    {description}
                  </Text>
                </VStack>

                {/* Right Column: Form */}
                <Box position="sticky" top="20px" px={4}>
                  <QuoteRequestForm country="US" />
                </Box>
              </Grid>
            </Container>
          </Box>

          {/* Cards Section */}
          <Box as="section" py={{ base: 16, md: 24 }} bg="blue.50">
            <Container maxW="7xl">
              <VStack spacing="8px">
                <Grid templateColumns={{ base: "1fr", md: "repeat(2, 1fr)" }} gap="8px" w="full">
                  {topCards.map((card) => (
                    <Box
                      key={card.title}
                      borderRadius="2xl"
                      border="1px solid"
                      borderColor="rgba(59, 130, 246, 0.2)"
                      position="relative"
                      h={{ base: "300px", md: "350px" }}
                      transition="all 0.3s"
                      bg="rgba(239, 246, 255, 0.3)"
                      p={{ base: 6, md: 8 }}
                      display="flex"
                      flexDirection="column"
                      justifyContent="center"
                      alignItems="center"
                      _hover={{
                        borderColor: "rgba(59, 130, 246, 0.4)",
                        bg: "rgba(239, 246, 255, 0.5)",
                        boxShadow: "lg",
                      }}
                    >
                      {card.iconName && (
                        <Icon
                          as={getFeatureIcon(card.iconName)}
                          boxSize={16}
                          color="blue.500"
                          mb={4}
                        />
                      )}
                      <VStack align="center" spacing={3} textAlign="center">
                        <Heading as="h3" size="lg" fontWeight="semibold" color="gray.900">
                          {card.title}
                        </Heading>
                        <Text color="gray.700" fontSize={{ base: "md", md: "lg" }}>
                          {card.description}
                        </Text>
                      </VStack>
                    </Box>
                  ))}
                </Grid>

                {bottomCardsToShow.length > 0 && (
                  <Grid
                    templateColumns={{
                      base: "1fr",
                      sm: "repeat(2, 1fr)",
                      md: `repeat(${bottomCardsToShow.length}, 1fr)`,
                    }}
                    gap="8px"
                    w="full"
                  >
                    {bottomCardsToShow.map((card) => (
                      <Box
                        key={card.title}
                        p={{ base: 6, md: 8 }}
                        bg="rgba(239, 246, 255, 0.4)"
                        backdropFilter="blur(12px)"
                        borderRadius="xl"
                        border="1px solid"
                        borderColor="rgba(59, 130, 246, 0.2)"
                        transition="all 0.3s"
                        position="relative"
                        overflow="hidden"
                        _hover={{
                          borderColor: "rgba(59, 130, 246, 0.4)",
                          bg: "rgba(239, 246, 255, 0.6)",
                          boxShadow: "md",
                        }}
                      >
                        {card.iconName && (
                          <Icon
                            as={getFeatureIcon(card.iconName)}
                            position="absolute"
                            top={-4}
                            right={-4}
                            boxSize={24}
                            color="blue.100"
                            opacity={0.3}
                            zIndex={0}
                          />
                        )}
                        <VStack align="start" spacing={3} position="relative" zIndex={1}>
                          <Heading as="h3" size="md" fontWeight="bold" color="gray.900">
                            {card.title}
                          </Heading>
                          <Text color="gray.600" fontSize="sm" lineHeight="tall">
                            {card.description}
                          </Text>
                        </VStack>
                      </Box>
                    ))}
                  </Grid>
                )}
              </VStack>
            </Container>
          </Box>

          <CompanyCarousel />
          <HowItWorksSection />
          <TestimonialsSection />
          <LetterSection />
          <PricingSection />
          <FaqSection />
          <CtaSection />
          <Footer />
        </Box>
      </Box>
    </>
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  const paths = Object.keys(featuresData).map((slug) => ({
    params: { slug },
  }));

  return {
    paths,
    fallback: false,
  };
};

export const getStaticProps: GetStaticProps<FeaturePageProps> = async ({ params }) => {
  const slug = params?.slug as string;
  const feature = getFeatureBySlug(slug);

  if (!feature) {
    return {
      notFound: true,
    };
  }

  return {
    props: {
      feature,
    },
  };
};
