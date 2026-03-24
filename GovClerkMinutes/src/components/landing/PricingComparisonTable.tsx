import {
  Box,
  Container,
  Heading,
  Text,
  VStack,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Icon,
  useBreakpointValue,
  Link as ChakraLink,
} from "@chakra-ui/react";
import Link from "next/link";
import { FaCheck, FaTimes } from "react-icons/fa";
import { HiArrowRight } from "react-icons/hi";
import { safeCapture } from "@/utils/safePosthog";

type PlanName = "Enterprise";

interface Feature {
  name: string;
  basic: boolean | string;
  pro: boolean | string;
  custom: boolean | string;
  isSection?: boolean;
  href?: string;
}

interface PricingComparisonTableProps {
  basicPrice?: number;
  proPrice?: number;
  priceUnit?: string;
  isAnnual?: boolean;
}

const features: Feature[] = [
  // Core Features
  {
    name: "Meeting Minutes Generation",
    basic: true,
    pro: true,
    custom: true,
    href: "/features/meeting-minutes-generation",
  },
  {
    name: "Transcript Generation",
    basic: true,
    pro: true,
    custom: true,
    href: "/features/transcript-generation",
  },
  {
    name: "Monthly Meeting Hours",
    basic: "5 hours",
    pro: "20 hours",
    custom: "Unlimited",
    href: "/features/meeting-hours",
  },
  {
    name: "Speaker Recognition",
    basic: "Basic",
    pro: "Cross-meeting",
    custom: "Cross-meeting",
    href: "/features/speaker-recognition",
  },
  {
    name: "Export to Word & PDF",
    basic: true,
    pro: true,
    custom: true,
    href: "/features/export-formats",
  },
  {
    name: "Copy to Clipboard",
    basic: true,
    pro: true,
    custom: true,
    href: "/features/copy-to-clipboard",
  },
  {
    name: "Mobile Web App (PWA)",
    basic: true,
    pro: true,
    custom: true,
    href: "/features/mobile-app",
  },
  {
    name: "AI Summary & Key Points",
    basic: true,
    pro: true,
    custom: true,
    href: "/features/ai-summary",
  },
  {
    name: "Action Items Extraction",
    basic: true,
    pro: true,
    custom: true,
    href: "/features/action-items",
  },
  {
    name: "Multi-language Support",
    basic: "96+ languages",
    pro: "96+ languages",
    custom: "96+ languages",
    href: "/features/multi-language",
  },
  {
    name: "Edit & Format Minutes",
    basic: true,
    pro: true,
    custom: true,
    href: "/features/edit-format",
  },
  {
    name: "Upload Audio/Video/Images",
    basic: true,
    pro: true,
    custom: true,
    href: "/features/upload-media",
  },

  // Templates Section
  {
    name: "Templates",
    basic: "",
    pro: "",
    custom: "",
    isSection: true,
  },
  {
    name: "Template Library",
    basic: true,
    pro: true,
    custom: true,
    href: "/features/template-library",
  },
  {
    name: "Create Minutes from Template",
    basic: true,
    pro: true,
    custom: true,
    href: "/features/create-from-template",
  },
  {
    name: "Create Template from Example",
    basic: false,
    pro: true,
    custom: true,
    href: "/features/create-template",
  },

  // Recorder Section
  {
    name: "Recorder",
    basic: "",
    pro: "",
    custom: "",
    isSection: true,
  },
  {
    name: "Built-in Recorder",
    basic: true,
    pro: true,
    custom: true,
    href: "/features/builtin-recorder",
  },
  {
    name: "Save Recordings",
    basic: true,
    pro: true,
    custom: true,
    href: "/features/save-recordings",
  },
  {
    name: "Generate Minutes from Recording",
    basic: true,
    pro: true,
    custom: true,
    href: "/features/recording-to-minutes",
  },

  // Support & Guarantees
  {
    name: "Support & Guarantees",
    basic: "",
    pro: "",
    custom: "",
    isSection: true,
  },
  {
    name: "Support",
    basic: "Basic",
    pro: "Priority",
    custom: "Priority + Chat",
    href: "/features/support",
  },
  {
    name: "Custom Volume",
    basic: false,
    pro: false,
    custom: true,
    href: "/features/custom-volume",
  },
  {
    name: "Dedicated Account Manager",
    basic: false,
    pro: false,
    custom: true,
    href: "/features/account-manager",
  },
  {
    name: "Money Back Guarantee",
    basic: "14 days",
    pro: "14 days",
    custom: "14 days",
    href: "/features/money-back-guarantee",
  },
];

const planColors = {
  Enterprise: "orange.500",
};

const FeatureCell = ({ value }: { value: boolean | string | undefined }) => {
  if (value === "" || value === undefined) {
    return null;
  }
  if (typeof value === "boolean") {
    return (
      <Icon as={value ? FaCheck : FaTimes} color={value ? "green.500" : "red.400"} boxSize={5} />
    );
  }
  return (
    <Text fontSize="sm" color="gray.700" fontWeight="medium">
      {value}
    </Text>
  );
};

export const PricingComparisonTable = ({
  basicPrice = 0,
  proPrice = 0,
  priceUnit = "$",
  isAnnual = true,
}: PricingComparisonTableProps = {}) => {
  const isMobile = useBreakpointValue({ base: true, lg: false });

  return (
    <Box
      as="section"
      py={{ base: 16, md: 24 }}
      bg="gray.50"
      onMouseEnter={() => {
        safeCapture("new_landing_page_section_seen", {
          section: "pricing_comparison",
          variant: "v2",
        });
      }}
    >
      <Container maxW="7xl">
        <VStack spacing={{ base: 8, md: 12 }}>
          <VStack spacing={4} textAlign="center">
            <Heading
              as="h2"
              fontSize={{ base: "3xl", md: "5xl" }}
              fontWeight="normal"
              fontFamily="Georgia, serif"
              color="gray.800"
            >
              Benefits
            </Heading>
            <Text fontSize={{ base: "lg", md: "xl" }} color="gray.600" maxW="2xl">
              Everything included in our Enterprise plan
            </Text>
          </VStack>

          <Box
            w="full"
            bg="white"
            borderRadius="2xl"
            border="1px solid"
            borderColor="gray.200"
            overflow="hidden"
            boxShadow="lg"
          >
            <Box overflowX="auto">
              <Table variant="simple" size={{ base: "sm", md: "md" }} sx={{ tableLayout: "fixed" }}>
                <Thead>
                  <Tr>
                    <Th
                      position="sticky"
                      left={0}
                      bg="white"
                      zIndex={1}
                      borderRight="1px solid"
                      borderColor="gray.200"
                      fontSize={{ base: "xs", md: "sm" }}
                      color="gray.700"
                      textTransform="none"
                      fontWeight="bold"
                      py={6}
                      borderBottom="none"
                      w={{ base: "60%", md: "70%" }}
                    >
                      Feature
                    </Th>
                    <Th textAlign="center" py={4} px={4} w={{ base: "40%", md: "30%" }}>
                      <Text
                        fontSize={{ base: "md", md: "xl" }}
                        fontWeight="bold"
                        color={planColors.Enterprise}
                        textTransform="none"
                      >
                        Enterprise
                      </Text>
                    </Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {features.map((feature) => {
                    if (feature.isSection) {
                      // Section header row
                      return (
                        <Tr key={feature.name} bg="gray.50">
                          <Td
                            colSpan={2}
                            position="sticky"
                            left={0}
                            bg="gray.50"
                            zIndex={1}
                            fontWeight="bold"
                            color="gray.900"
                            fontSize={{ base: "sm", md: "md" }}
                            py={3}
                            textTransform="uppercase"
                            letterSpacing="wide"
                          >
                            {feature.name}
                          </Td>
                        </Tr>
                      );
                    }

                    // Regular feature row
                    return (
                      <Tr
                        key={feature.name}
                        _hover={{ bg: "gray.50" }}
                        transition="background 0.2s"
                      >
                        <Td
                          position="sticky"
                          left={0}
                          bg="white"
                          zIndex={1}
                          borderRight="1px solid"
                          borderColor="gray.200"
                          fontWeight="medium"
                          color="gray.800"
                          fontSize={{ base: "xs", md: "sm" }}
                          py={4}
                          _groupHover={{ bg: "gray.50" }}
                        >
                          {feature.href ? (
                            <ChakraLink
                              as={Link}
                              href={feature.href}
                              display="flex"
                              alignItems="center"
                              justifyContent="space-between"
                              color="gray.800"
                              _hover={{ color: "blue.500", textDecoration: "underline" }}
                              onClick={() =>
                                safeCapture("pricing_table_feature_clicked", {
                                  feature: feature.name,
                                })
                              }
                            >
                              <Text as="span">{feature.name}</Text>
                              <Icon
                                as={HiArrowRight}
                                boxSize={{ base: 3, md: 4 }}
                                color="gray.400"
                                transition="all 0.2s"
                                _groupHover={{ color: "blue.500", transform: "translateX(2px)" }}
                              />
                            </ChakraLink>
                          ) : (
                            feature.name
                          )}
                        </Td>
                        <Td textAlign="center" py={4}>
                          <FeatureCell value={feature.custom} />
                        </Td>
                      </Tr>
                    );
                  })}
                </Tbody>
              </Table>
            </Box>
          </Box>
        </VStack>
      </Container>
    </Box>
  );
};
