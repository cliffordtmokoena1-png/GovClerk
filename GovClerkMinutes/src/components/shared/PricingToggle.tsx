import { Box, Text, HStack, useBreakpointValue } from "@chakra-ui/react";

type Props = {
  isAnnual: boolean;
  onToggle: (isAnnual: boolean) => void;
  className?: string;
};

export default function PricingToggle({ isAnnual, onToggle, className = "" }: Props) {
  const isMobile = useBreakpointValue({ base: true, md: false });

  return (
    <Box className={className}>
      <HStack spacing={4} justify="center" mb={6}>
        <Text
          fontSize={isMobile ? "sm" : "md"}
          fontWeight="medium"
          color={!isAnnual ? "blue.600" : "gray.500"}
        >
          Monthly
        </Text>

        <Box
          position="relative"
          w="60px"
          h="32px"
          bg={isAnnual ? "blue.500" : "gray.300"}
          borderRadius="full"
          cursor="pointer"
          transition="all 0.2s"
          onClick={() => onToggle(!isAnnual)}
          _hover={{ transform: "scale(1.05)" }}
        >
          <Box
            position="absolute"
            top="2px"
            left={isAnnual ? "30px" : "2px"}
            w="28px"
            h="28px"
            bg="white"
            borderRadius="full"
            transition="all 0.2s"
            boxShadow="sm"
          />
        </Box>

        <HStack spacing={1}>
          <Text
            fontSize={isMobile ? "sm" : "md"}
            fontWeight="medium"
            color={isAnnual ? "blue.600" : "gray.500"}
          >
            Annual
          </Text>
          <Box
            bg="green.100"
            color="green.700"
            px={2}
            py={1}
            borderRadius="md"
            fontSize="xs"
            fontWeight="semibold"
          >
            2 MONTHS FREE
          </Box>
        </HStack>
      </HStack>

      {isMobile && isAnnual && (
        <Text textAlign="center" fontSize="sm" color="green.600" fontWeight="medium" my={2}>
          🎉 You&apos;re saving with annual billing!
        </Text>
      )}
    </Box>
  );
}
