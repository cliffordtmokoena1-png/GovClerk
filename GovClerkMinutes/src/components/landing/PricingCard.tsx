import {
  Box,
  VStack,
  HStack,
  Heading,
  Text,
  Button,
  List,
  ListItem,
  ListIcon,
} from "@chakra-ui/react";
import { FaCheck } from "react-icons/fa";
import Link from "next/link";
import { scrollToIntakeForm, scrollToQuoteForm } from "./IntakeForm";

interface PricingCardProps {
  title: string;
  subtitle: string;
  price: number | string;
  priceUnit: string;
  features: string[];
  isPopular?: boolean;
  tokens?: number;
  isAnnual: boolean;
  monthsFree?: number;
  buttonText?: string;
  buttonLink?: string;
}

export const PricingCard = ({
  title,
  subtitle,
  price,
  priceUnit,
  features,
  isPopular = false,
  tokens,
  isAnnual,
  monthsFree,
  buttonText = "Get Started",
  buttonLink = "/sign-up",
}: PricingCardProps) => {
  const displayPrice = price === -1 ? "Custom" : `${priceUnit}${price}`;

  const monthlyPrice = isAnnual && price !== -1 ? ((price as number) / 12).toFixed(2) : price;

  return (
    <Box
      position="relative"
      bg={isPopular ? "rgba(239, 246, 255, 0.6)" : "rgba(255, 255, 255, 0.6)"}
      backdropFilter="blur(12px)"
      borderRadius="2xl"
      border="2px solid"
      borderColor={isPopular ? "rgba(59, 130, 246, 0.5)" : "rgba(59, 130, 246, 0.2)"}
      p={{ base: 8, md: 10 }}
      transition="all 0.3s"
      transform={{ base: "scale(1)", md: isPopular ? "scale(1.05)" : "scale(1)" }}
      _hover={{
        "@media (hover: hover)": {
          borderColor: "rgba(59, 130, 246, 0.6)",
          boxShadow: "xl",
          transform: isPopular ? "scale(1.08)" : "scale(1.03)",
        },
      }}
      display="flex"
      flexDirection="column"
      h="full"
      w="full"
      maxW={{ base: "400px", lg: "none" }}
    >
      {isPopular && (
        <Box
          position="absolute"
          top={-4}
          left="50%"
          transform="translateX(-50%)"
          bg="blue.500"
          color="white"
          px={6}
          py={2}
          borderRadius="full"
          fontSize="sm"
          fontWeight="bold"
        >
          Most Popular
        </Box>
      )}

      <VStack align="start" spacing={6} flex="1">
        <VStack align="start" spacing={2} w="full">
          <Heading as="h3" size="lg" fontWeight="bold" color="gray.900">
            {title}
          </Heading>
          <Text color="gray.600" fontSize="sm">
            {subtitle}
          </Text>
        </VStack>

        <VStack align="start" spacing={2} w="full">
          <HStack>
            <Heading as="div" size="2xl" fontWeight="bold" color="blue.600">
              {isAnnual && price !== -1 ? `${priceUnit}${monthlyPrice}` : displayPrice}
            </Heading>
            {price !== -1 && (
              <Text color="gray.600" fontSize="md">
                /month
              </Text>
            )}
          </HStack>
          {isAnnual && price !== -1 && monthsFree && (
            <VStack align="start" spacing={0}>
              <Text color="gray.500" fontSize="sm">
                Billed annually at {displayPrice}
              </Text>
              <Text color="green.600" fontSize="sm" fontWeight="semibold">
                Save {monthsFree} months free!
              </Text>
            </VStack>
          )}
          {tokens && tokens !== -1 && (
            <Text color="gray.500" fontSize="sm">
              {tokens} tokens included
            </Text>
          )}
        </VStack>

        {/* Features */}
        <List spacing={3} w="full" flex="1">
          {features.map((feature, index) => (
            <ListItem key={index} display="flex" alignItems="flex-start">
              <ListIcon as={FaCheck} color="blue.500" mt={1} />
              <Text color="gray.700" fontSize="sm">
                {feature}
              </Text>
            </ListItem>
          ))}
        </List>
      </VStack>

      {/* Button - Fixed to bottom */}
      <Box w="full" pt={6}>
        <Button
          as={buttonLink.startsWith("#") || buttonLink.startsWith("mailto:") ? "a" : Link}
          href={buttonLink}
          w="full"
          size="lg"
          bg={isPopular ? "#FF6B35" : "blue.500"}
          color="white"
          transition="all 0.2s"
          _hover={{
            "@media (hover: hover)": {
              bg: isPopular ? "#E65A2E" : "blue.600",
            },
          }}
          onClick={(e) => {
            if (buttonLink === "#intake-form") {
              e.preventDefault();
              if (!scrollToQuoteForm()) {
                scrollToIntakeForm();
              }
            }
          }}
        >
          {buttonText}
        </Button>
      </Box>
    </Box>
  );
};
