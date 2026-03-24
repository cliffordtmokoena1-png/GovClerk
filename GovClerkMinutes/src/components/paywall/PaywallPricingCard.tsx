import {
  Box,
  Text,
  VStack,
  Flex,
  List,
  ListItem,
  ListIcon,
  useBreakpointValue,
} from "@chakra-ui/react";
import { CheckIcon, CloseIcon } from "@chakra-ui/icons";
import { SubscriptionPlan, getEffectiveMonthlyPrice, formatPrice } from "@/utils/price";

type Props = {
  plan: SubscriptionPlan | "Custom";
  price: number;
  priceUnit?: string;
  features: Array<{
    text: string;
    included: boolean;
  }>;
  isRecommended?: boolean;
  isAnnual: boolean;
  country?: string;
  onToggleBilling: () => void;
  showBillingToggle?: boolean;
};

export default function PaywallPricingCard({
  plan,
  price,
  priceUnit,
  features,
  isRecommended,
  isAnnual = true,
  country,
  onToggleBilling,
  showBillingToggle,
}: Props) {
  const isMobile = useBreakpointValue({ base: true, md: false });
  const highlight = isRecommended;
  const isCustom = plan === "Custom";

  const PriceDisplay = () => {
    if (isCustom) {
      return (
        <Text fontSize="sm" color="gray.500">
          Price available upon request
        </Text>
      );
    }

    if (
      isAnnual &&
      (plan === "Basic" ||
        plan === "Pro" ||
        plan === "Essential" ||
        plan === "Professional" ||
        plan === "Elite" ||
        plan === "Premium")
    ) {
      const effectiveMonthlyPrice = getEffectiveMonthlyPrice(
        country,
        (plan + "_Annual") as "Basic_Annual" | "Pro_Annual" | "Essential_Annual" | "Professional_Annual" | "Elite_Annual" | "Premium_Annual"
      );

      return (
        <>
          <Flex align="flex-end" justify="center" gap={3}>
            <Text
              fontSize="5xl"
              fontWeight="bold"
              color={highlight ? "blue.600" : "gray.900"}
              lineHeight="1"
              alignSelf="flex-end"
            >
              {priceUnit ?? "$"}
              {formatPrice(effectiveMonthlyPrice)}
            </Text>
            <VStack spacing={0} align="flex-start" direction="column-reverse">
              <Text fontSize="xs" color="gray.500" lineHeight="1.2">
                per month
              </Text>
              <Text fontSize="xs" color="green.600" fontWeight="medium" lineHeight="1.2">
                ~2 months free
              </Text>
              <Text fontSize="xs" color="gray.500" lineHeight="1.2">
                billed annually {priceUnit ?? "$"}
                {formatPrice(price)}
              </Text>
            </VStack>
          </Flex>
        </>
      );
    }

    return (
      <>
        <Flex align="flex-end" justify="center" gap={3}>
          <Text
            fontSize="5xl"
            fontWeight="bold"
            color={highlight ? "blue.600" : "gray.900"}
            lineHeight="1"
            alignSelf="flex-end"
          >
            {priceUnit ?? "$"}
            {formatPrice(price)}
          </Text>
          <VStack spacing={0} align="flex-start" direction="column-reverse">
            <Text fontSize="xs" color="gray.500" lineHeight="1.2">
              per month
            </Text>
          </VStack>
        </Flex>
      </>
    );
  };

  if (isMobile) {
    return (
      <Box overflow="hidden" bg="white" w="full">
        <Box p={6}>
          <VStack spacing={4} align="stretch">
            <Box>
              <Text fontSize="xl" fontWeight="bold" mb={2}>
                {plan}
              </Text>
              <PriceDisplay />
            </Box>
            <List spacing={3}>
              {features.map((feature, index) => (
                <ListItem key={index} display="flex" alignItems="center">
                  <ListIcon
                    as={feature.included ? CheckIcon : CloseIcon}
                    color={feature.included ? "blue.500" : "red.500"}
                    boxSize={5}
                    mr={2}
                  />
                  <Text
                    fontSize="sm"
                    color={feature.included ? "gray.600" : "gray.400"}
                    textDecoration={!feature.included ? "line-through" : undefined}
                  >
                    {feature.text}
                  </Text>
                </ListItem>
              ))}
            </List>
          </VStack>
        </Box>
      </Box>
    );
  }

  return (
    <Box bg={highlight ? "blue.50" : "white"} transition="all 0.2s">
      <Box p={6}>
        <VStack spacing={4} align="stretch">
          <Box>
            <Text
              fontSize="xl"
              fontWeight="bold"
              color={highlight ? "blue.600" : "gray.900"}
              mb={2}
            >
              {plan}
            </Text>
            <PriceDisplay />
          </Box>

          {showBillingToggle && plan !== "Custom" && (
            <Text
              fontSize="xs"
              color="blue.600"
              textAlign="center"
              cursor="pointer"
              textDecoration="underline"
              _hover={{ color: "blue.700" }}
              onClick={onToggleBilling}
              mb={3}
            >
              {isAnnual ? "View monthly billing" : "Save with yearly (2 Months Free)"}
            </Text>
          )}

          <List spacing={3}>
            {features.map((feature, index) => (
              <ListItem key={index} display="flex" alignItems="center">
                <ListIcon
                  as={feature.included ? CheckIcon : CloseIcon}
                  color={feature.included ? (highlight ? "blue.500" : "gray.500") : "red.500"}
                  boxSize={5}
                  mr={2}
                />
                <Text
                  fontSize="sm"
                  color={feature.included ? "gray.600" : "gray.400"}
                  textDecoration={!feature.included ? "line-through" : undefined}
                >
                  {feature.text}
                </Text>
              </ListItem>
            ))}
          </List>
        </VStack>
      </Box>
    </Box>
  );
}
