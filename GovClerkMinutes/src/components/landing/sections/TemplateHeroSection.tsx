import React from "react";
import { Box, Container, Heading, Text, HStack, Stack, Icon, VStack, Grid } from "@chakra-ui/react";
import Image from "next/image";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/router";
import { FaStar } from "react-icons/fa6";
import { safeCapture } from "@/utils/safePosthog";
import QuoteRequestForm from "../QuoteRequestForm";
import TemplateHeroPreview from "../TemplateHeroPreview";

interface V2TemplateHeroSectionProps {
  title: string;
  subtitle: string;
  subheadline: string;
  image: string;
  mobileImage: string;
  country: string | null;
  templatePreview?: string;
}

export const TemplateHeroSection = ({
  title,
  subtitle,
  subheadline,
  image,
  mobileImage,
  country,
  templatePreview,
}: V2TemplateHeroSectionProps) => {
  const router = useRouter();
  const { isLoaded, userId } = useAuth();

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
          variant: "v2_template",
        });
      }}
      overflow="hidden"
    >
      {/* V2 Background */}
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
          spacing={{ base: 6, md: 0 }}
          display={{ base: "flex", md: "none" }}
          textAlign="center"
        >
          {/* Template Hero Title - V2 Style (smaller for longer template names) */}
          <VStack>
            <Heading
              as="h1"
              fontSize={{ base: "xl", sm: "2xl", md: "5xl" }}
              lineHeight={{ base: "1.4", md: "0" }}
              fontWeight="normal"
              fontFamily="Georgia, serif"
              color="gray.700"
              maxW="4xl"
              mt={6}
            >
              {title}
              {!templatePreview && (
                <Box as="span" display={{ base: "block", md: "none" }}>
                  <Box as="span" bg="yellow.100" px={{ base: 2, md: 3 }} py={1} borderRadius="md">
                    in seconds
                  </Box>
                  ,{" "}
                  <Box as="span" color="gray.400" textDecoration="line-through">
                    not hours
                  </Box>
                </Box>
              )}
            </Heading>
          </VStack>

          {/* Template-specific subtitle - V2 Style with yellow highlight (desktop only for non-template) */}
          {!templatePreview && (
            <Heading
              as="h2"
              fontSize={{ base: "xl", sm: "2xl", md: "5xl" }}
              lineHeight="1.1"
              fontWeight="normal"
              fontFamily="Georgia, serif"
              color="gray.700"
              maxW="4xl"
              mt={{ base: 2, md: 4 }}
              display={{ base: "none", md: "block" }}
            >
              <Box as="span" bg="yellow.100" px={{ base: 2, md: 3 }} py={1} borderRadius="md">
                in seconds
              </Box>
              ,{" "}
              <Box as="span" color="gray.400" textDecoration="line-through">
                not hours
              </Box>
            </Heading>
          )}

          {templatePreview && (
            <Heading
              as="h2"
              fontSize={{ base: "xl", sm: "2xl", md: "5xl" }}
              lineHeight="1.1"
              fontWeight="normal"
              fontFamily="Georgia, serif"
              color="gray.700"
              maxW="4xl"
              mt={{ base: 2, md: 4 }}
            >
              with our{" "}
              <Box as="span" bg="yellow.100" px={{ base: 2, md: 3 }} py={1} borderRadius="md">
                personalized template
              </Box>
            </Heading>
          )}

          <Text fontSize={{ base: "md", md: "xl" }} color="gray.600" maxW="3xl" lineHeight="1.8">
            {subtitle}
          </Text>

          {/* Badge with star rating */}
          <Box
            display="flex"
            alignItems="center"
            justifyContent="center"
            border="1px solid"
            borderColor="blue.200"
            p={2}
            px={3}
            bg="blue.50"
            borderRadius="2xl"
            w="full"
            maxW="300px"
          >
            <Stack spacing={2} direction="column" align="center">
              <HStack spacing={1} color="yellow.400" justify="center">
                <Icon as={FaStar} />
                <Icon as={FaStar} />
                <Icon as={FaStar} />
                <Icon as={FaStar} />
                <Icon as={FaStar} />
              </HStack>
              <Text fontSize="xs" fontWeight="medium" color="gray.700" textAlign="center">
                <Text as="span" fontWeight="semibold">
                  {subheadline.split(" automate")[0]}
                </Text>{" "}
                automate meeting minutes with us
              </Text>
            </Stack>
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

          {/* Mobile Preview/Screenshot */}
          {templatePreview ? (
            <TemplateHeroPreview content={templatePreview} />
          ) : (
            <Box w="full">
              <Image
                src={mobileImage}
                alt="GovClerkMinutes Demo"
                width={600}
                height={800}
                layout="responsive"
                priority
              />
            </Box>
          )}
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

            {!templatePreview && (
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
            )}

            {templatePreview && (
              <Heading
                as="h2"
                fontSize="clamp(1.425rem, 3.8vw, 2.375rem)"
                lineHeight="1.1"
                fontWeight="normal"
                fontFamily="Georgia, serif"
                color="gray.700"
                mt={0}
              >
                with our{" "}
                <Box as="span" bg="yellow.100" px={3} py={1} borderRadius="md">
                  personalized template
                </Box>
              </Heading>
            )}

            <Text fontSize="clamp(0.95rem, 1.425vw, 1.19rem)" color="gray.600" lineHeight="1.8">
              {subtitle}
            </Text>

            <Box
              display="flex"
              alignItems="center"
              border="1px solid"
              borderColor="blue.200"
              p={2}
              px={6}
              bg="blue.50"
              borderRadius="2xl"
              alignSelf="center"
              mb={8}
            >
              <Stack spacing={2} direction="row" align="center">
                <HStack spacing={1} color="yellow.400">
                  <Icon as={FaStar} />
                  <Icon as={FaStar} />
                  <Icon as={FaStar} />
                  <Icon as={FaStar} />
                  <Icon as={FaStar} />
                </HStack>
                <Text
                  fontSize="clamp(0.71rem, 1.14vw, 0.83rem)"
                  fontWeight="medium"
                  color="gray.700"
                >
                  <Text as="span" fontWeight="semibold">
                    {subheadline.split(" automate")[0]}
                  </Text>{" "}
                  automate meeting minutes with us
                </Text>
              </Stack>
            </Box>

            {/* Desktop Preview/Screenshot */}
            {templatePreview ? (
              <TemplateHeroPreview content={templatePreview} />
            ) : (
              <Box
                maxW="7xl"
                bg="gray.900"
                boxShadow="2xl"
                rounded="2xl"
                overflow="hidden"
                border="1px solid"
                borderColor="gray.800"
                w="full"
              >
                <Image
                  src={image}
                  alt="GovClerkMinutes Demo"
                  width={1200}
                  height={800}
                  layout="responsive"
                  priority
                />
              </Box>
            )}
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
