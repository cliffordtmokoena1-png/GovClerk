import { HStack, VStack, Button, Badge } from "@chakra-ui/react";

interface PricingToggleProps {
  isAnnual: boolean;
  onToggle: (annual: boolean) => void;
}

export const PricingToggle = ({ isAnnual, onToggle }: PricingToggleProps) => {
  const buttonProps = (isActive: boolean) => ({
    size: "md" as const,
    borderRadius: "full",
    bg: isActive ? "white" : "transparent",
    color: isActive ? "gray.900" : "gray.600",
    fontWeight: isActive ? "semibold" : "normal",
    boxShadow: isActive ? "sm" : "none",
    transition: "all 0.2s",
    _hover: { "@media (hover: hover)": { bg: isActive ? "white" : "gray.50" } },
    px: 6,
  });

  return (
    <VStack spacing={2}>
      <HStack
        spacing={0}
        bg="gray.100"
        borderRadius="full"
        p={1}
        display="inline-flex"
        position="relative"
      >
        <Button onClick={() => onToggle(false)} {...buttonProps(!isAnnual)}>
          Monthly
        </Button>
        <Button onClick={() => onToggle(true)} {...buttonProps(isAnnual)} position="relative">
          Annual
          <Badge
            position="absolute"
            top={-2}
            right={-2}
            bg="green.500"
            color="white"
            fontSize="2xs"
            px={2}
            py={0.5}
            borderRadius="full"
          >
            2 months free
          </Badge>
        </Button>
      </HStack>
    </VStack>
  );
};
