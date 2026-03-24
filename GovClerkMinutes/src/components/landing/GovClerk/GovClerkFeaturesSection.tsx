import { Box, Container, Heading, Grid, VStack, Text, Icon } from "@chakra-ui/react";
import { LuClock, LuFileText, LuLayoutTemplate, LuSmartphone } from "react-icons/lu";
import Image from "next/image";
import { safeCapture } from "@/utils/safePosthog";
import { getIcon } from "@/utils/landing/landingUtils";

interface CustomFeature {
  title: string;
  description: string;
  iconName: string;
}

interface V2FeaturesSectionProps {
  customFeatures?: CustomFeature[];
  customHeading?: {
    title: string;
    subtitle: string;
  };
}

export const FeaturesSection = ({ customFeatures, customHeading }: V2FeaturesSectionProps) => {
  const topFeatures = [
    {
      title: "High Quality Meeting Minutes",
      description:
        "Transform any recording, image, or document into professionally formatted minutes with AI precision that captures every detail.",
      imageSrc: "/screenshots/minutes-excerpt.png",
    },
    {
      title: "Accurate Transcript",
      description:
        "State-of-the-art speech recognition delivers up to 99% accuracy for transcripts you can trust in legal, business, or academic settings.",
      imageSrc: "/screenshots/transcripts-excerpt.png",
    },
  ];

  const defaultBottomFeatures = [
    {
      icon: LuClock,
      title: "Save Hours Every Week",
      description:
        "Intelligent automation remembers speakers, updates formatting, and handles tedious work so you focus on what matters most.",
    },
    {
      icon: LuFileText,
      title: "Multiple Formats",
      description:
        "Export to Word, PDF, Markdown, or plain text with customizable layouts matching your organization's standards in one click.",
    },
    {
      icon: LuLayoutTemplate,
      title: "Meeting Templates",
      description:
        "Start with professionally designed templates for any meeting type and customize them to fit your specific workflow needs.",
    },
    {
      icon: LuSmartphone,
      title: "Minutes on the Go",
      description:
        "Edit, approve, and share meeting minutes anywhere with full mobile functionality through our progressive web application.",
    },
  ];

  // Use custom features if provided, otherwise use default
  const bottomFeatures = customFeatures
    ? customFeatures.map((feature) => ({
        icon: getIcon(feature.iconName),
        title: feature.title,
        description: feature.description,
      }))
    : defaultBottomFeatures;

  return (
    <Box
      as="section"
      id="features"
      py={{ base: 16, md: 24 }}
      bg="white"
      onMouseEnter={() => {
        safeCapture("new_landing_page_section_seen", {
          section: "features",
          variant: "v2",
        });
      }}
    >
      <Container maxW="7xl">
        <VStack spacing="8px">
          <VStack spacing={4} textAlign="center">
            <Heading
              as="h2"
              fontSize={{ base: "3xl", md: "5xl" }}
              fontWeight="normal"
              fontFamily="Georgia, serif"
              color="gray.800"
            >
              {customHeading?.title || "Everything you need"}
            </Heading>
            <Text fontSize={{ base: "lg", md: "xl" }} color="gray.600" maxW="2xl" mb={8}>
              {customHeading?.subtitle ||
                "Powerful features to make your meeting minutes process seamless"}
            </Text>
          </VStack>

          <Grid templateColumns={{ base: "1fr", md: "repeat(2, 1fr)" }} gap="8px" w="full">
            {topFeatures.map((feature, index) => (
              <Box
                key={index}
                borderRadius="2xl"
                border="1px solid"
                borderColor="rgba(59, 130, 246, 0.2)"
                position="relative"
                h={{ base: "400px", md: "450px" }}
                transition="all 0.3s"
                bg="white"
                p={{ base: 6, md: 8 }}
                display="flex"
                flexDirection="column"
                justifyContent="flex-end"
                _hover={{
                  "@media (hover: hover)": {
                    borderColor: "rgba(59, 130, 246, 0.4)",
                    bg: "rgba(239, 246, 255, 0.5)",
                    boxShadow: "lg",
                  },
                }}
                overflow="hidden"
              >
                <Box
                  position="absolute"
                  top={{ base: 6, md: 8 }}
                  left={{ base: 6, md: 8 }}
                  right={{ base: 6, md: 8 }}
                  h="full"
                  borderRadius="xl"
                  overflow="hidden"
                  bg="white"
                  boxShadow="lg"
                  border="1px solid"
                  borderColor="gray.200"
                  opacity={0.6}
                  zIndex={0}
                >
                  <Image
                    src={feature.imageSrc}
                    alt={feature.title}
                    fill
                    style={{ objectFit: "cover", objectPosition: "top" }}
                  />
                </Box>

                <VStack
                  align="start"
                  spacing={3}
                  position="relative"
                  zIndex={1}
                  p={{ base: 6, md: 8 }}
                  mx={{ base: -6, md: -8 }}
                  mb={{ base: -6, md: -8 }}
                  minH={{ base: "300px", md: "380px" }}
                  justifyContent="flex-end"
                  bgGradient="linear(to-b, transparent 0%, rgba(255, 255, 255, 0.6) 15%, rgba(255, 255, 255, 0.95) 60%, white 100%)"
                >
                  <Heading as="h3" size="lg" fontWeight="semibold" color="gray.900">
                    {feature.title}
                  </Heading>
                  <Text color="gray.700" fontSize={{ base: "md", md: "lg" }}>
                    {feature.description}
                  </Text>
                </VStack>
              </Box>
            ))}
          </Grid>

          <Grid
            templateColumns={{ base: "1fr", sm: "repeat(2, 1fr)", md: "repeat(4, 1fr)" }}
            gap="8px"
            w="full"
          >
            {bottomFeatures.map((feature, index) => (
              <Box
                key={index}
                p={{ base: 6, md: 8 }}
                bg="white"
                backdropFilter="blur(12px)"
                borderRadius="xl"
                border="1px solid"
                borderColor="rgba(59, 130, 246, 0.2)"
                transition="all 0.3s"
                position="relative"
                overflow="hidden"
                _hover={{
                  "@media (hover: hover)": {
                    borderColor: "rgba(59, 130, 246, 0.4)",
                    boxShadow: "md",
                  },
                }}
              >
                <Icon
                  as={feature.icon}
                  position="absolute"
                  top={-4}
                  right={-4}
                  boxSize={24}
                  color="blue.100"
                  opacity={0.3}
                  zIndex={0}
                />
                <VStack align="start" spacing={3} position="relative" zIndex={1}>
                  <Heading as="h3" size="md" fontWeight="bold" color="gray.900">
                    {feature.title}
                  </Heading>
                  <Text color="gray.600" fontSize="sm" lineHeight="tall">
                    {feature.description}
                  </Text>
                </VStack>
              </Box>
            ))}
          </Grid>
        </VStack>
      </Container>
    </Box>
  );
};
