import {
  Box,
  Button,
  Flex,
  Heading,
  Stack,
  Text,
  List,
  ListItem,
  ListIcon,
  HStack,
  useToast,
} from "@chakra-ui/react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/router";
import { BsCheck } from "react-icons/bs";
import { safeCapture } from "@/utils/safePosthog";
import { FaArrowRightLong } from "react-icons/fa6";
import Cookies from "js-cookie";
import { getEffectiveMonthlyPrice, formatPrice } from "@/utils/price";
import { useOrgContext } from "@/contexts/OrgContext";
import { openWhatsAppChat } from "@/utils/whatsapp";
import { useState } from "react";

// Plans that support annual billing with the PayStack subscription tiers.
// Essential is intentionally excluded here because PayStack has no annual
// Essential plan — it will always subscribe to the monthly variant.
const NEW_TIERS_WITH_ANNUAL = ["Professional", "Elite", "Premium"] as const;
const NEW_TIERS = ["Essential", "Professional", "Elite", "Premium"] as const;
const DEFAULT_COUNTRY_CODE = "ZA";

// Number of months saved per plan when billed annually.
const ANNUAL_MONTHS_FREE: Record<string, number> = {
  Professional: 2,
  Elite: 2,
  Premium: 3,
};

interface Props {
  title: string;
  subtitle: string;
  price: number;
  priceUnit: string;
  features: string[];
  clientReferenceId: string;
  priceId: string;
  isPopular?: boolean;
  tokens: number;
  isAnnual: boolean;
  country?: string; // For calculating annual pricing
  onToggleBilling: () => void; // Function to toggle between monthly/annual
}

// Helper function to render price display based on plan type and billing period
function renderPriceDisplay(
  title: string,
  price: number,
  priceUnit: string,
  isAnnual: boolean,
  discount: string | undefined,
  country?: string
) {
  // Custom plan
  if (price === -1) {
    return (
      <Flex align="center" justify="center" gap={4}>
        <Text fontSize="3xl" fontWeight="bold" letterSpacing="tight" color="gray.900">
          Get Quote
        </Text>
      </Flex>
    );
  }

  // Annual pricing for new PayStack tiers that have an annual plan
  if (isAnnual && (NEW_TIERS_WITH_ANNUAL as readonly string[]).includes(title) && country) {
    const effectiveMonthlyPrice = getEffectiveMonthlyPrice(
      country,
      (title + "_Annual") as
        | "Essential_Annual"
        | "Professional_Annual"
        | "Elite_Annual"
        | "Premium_Annual"
    );

    return (
      <Flex align="flex-end" justify="center" gap={4}>
        <Text
          fontSize="5xl"
          fontWeight="bold"
          letterSpacing="tight"
          color="gray.900"
          lineHeight="1"
          alignSelf="flex-end"
        >
          {priceUnit}
          {formatPrice(effectiveMonthlyPrice)}
        </Text>
        <Stack spacing={0} align="flex-start" direction="column-reverse">
          <Text fontSize="sm" color="gray.500" lineHeight="1.2">
            per month
          </Text>
          <Text fontSize="xs" color="green.600" fontWeight="medium" lineHeight="1.2">
            ~{ANNUAL_MONTHS_FREE[title] ?? 2} months free
          </Text>
          <Text fontSize="xs" color="gray.500" lineHeight="1.2">
            billed annually {priceUnit}
            {formatPrice(price)}
          </Text>
        </Stack>
      </Flex>
    );
  }

  // Monthly pricing
  return (
    <Flex align="flex-end" justify="center" gap={4}>
      <Text
        fontSize="5xl"
        fontWeight="bold"
        letterSpacing="tight"
        color="gray.900"
        lineHeight="1"
        alignSelf="flex-end"
      >
        {priceUnit}
        {formatPrice(Math.floor(100 * price * (discount === "true" ? 0.75 : 1)) / 100)}
      </Text>
      <Stack spacing={0} align="flex-start" direction="column-reverse">
        <Text fontSize="sm" color="gray.500" lineHeight="1.2">
          per month
        </Text>
      </Stack>
    </Flex>
  );
}

export default function PricingCard({
  title,
  subtitle,
  price,
  priceUnit,
  features,
  clientReferenceId,
  priceId,
  isPopular,
  tokens,
  isAnnual,
  country,
  onToggleBilling,
}: Props) {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const { orgId } = useOrgContext();
  const toast = useToast();
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const buttonLabel = price === -1 ? "Contact Support" : isSignedIn ? "Subscribe" : "Get Started";
  const discount = Cookies.get("mgdiscount");

  return (
    <Box
      bg="white"
      borderRadius="2xl"
      border="1px solid"
      borderColor={isPopular ? "blue.200" : "gray.200"}
      position="relative"
      transition="all 0.2s"
      overflow="hidden"
      boxShadow="lg"
      _hover={{
        transform: "translateY(-4px)",
        boxShadow: "2xl",
      }}
      _before={{
        content: '""',
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: "4px",
        bgGradient: isPopular ? "linear(to-r, blue.400, blue.600)" : "none",
        borderTopRadius: "2xl",
      }}
    >
      <Box p={6}>
        <Stack spacing={4} align="center">
          <Stack spacing={1} textAlign="center">
            <HStack spacing={2} align="center" justifyContent="center">
              <Heading size="lg" color="gray.900">
                {title}
              </Heading>
              {isPopular && (
                <Box
                  bg="blue.500"
                  color="white"
                  px={3}
                  py={1}
                  borderRadius="full"
                  fontSize="sm"
                  fontWeight="medium"
                  boxShadow="sm"
                >
                  Most Popular
                </Box>
              )}
            </HStack>
            <Text fontSize="md" color="gray.500">
              {subtitle}
            </Text>
          </Stack>

          <Stack spacing={2} align="center">
            {discount === "true" && price !== -1 && (
              <Flex alignItems="center" gap={2} color="gray.500" mb={-1}>
                <Text fontSize="xl" textDecoration="line-through">
                  {`${priceUnit}${formatPrice(price)}`}
                </Text>
                <Text fontSize="sm">25% off</Text>
              </Flex>
            )}
            {renderPriceDisplay(title, price, priceUnit, isAnnual, discount, country)}
          </Stack>

          <Button
            colorScheme="messenger"
            size="lg"
            fontSize="md"
            rightIcon={<FaArrowRightLong />}
            w="full"
            isLoading={isCheckoutLoading}
            loadingText="Loading…"
            onClick={async () => {
              const start = performance.now();
              if (price === -1) {
                safeCapture("paywall_button_click", { click_type: "custom" });
                openWhatsAppChat("Hi! I'm interested in a custom plan.", "pricing_card");
              } else if (!isLoaded || !isSignedIn) {
                safeCapture("paywall_button_click", { click_type: "signup" });
                router.push(`/sign-up?ph=${price}`);
              } else {
                safeCapture("paywall_button_click", { click_type: "payment" });
                setIsCheckoutLoading(true);
                try {
                  // Only Professional, Elite, and Premium have annual PayStack plans.
                  // Essential is always billed monthly.
                  const planName =
                    isAnnual && (NEW_TIERS_WITH_ANNUAL as readonly string[]).includes(title)
                      ? `${title}_Annual`
                      : title;

                  const res = await fetch("/api/create-checkout-session", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      plan: planName,
                      country: country ?? DEFAULT_COUNTRY_CODE,
                      clientReferenceId,
                      mode: "subscription",
                      orgId,
                    }),
                  }).then((r) => r.json());

                  safeCapture("paywall_button_create_checkout", {
                    duration: Math.round(performance.now() - start),
                  });

                  if (res.url) {
                    router.push(res.url);
                  } else {
                    throw new Error(res.error ?? "No checkout URL returned");
                  }
                } catch (err) {
                  console.error("[PricingCard] checkout error", err);
                  toast({
                    title: "Checkout failed",
                    description:
                      "We could not open the payment page. Please try again or contact support.",
                    status: "error",
                    duration: 6000,
                    isClosable: true,
                  });
                } finally {
                  setIsCheckoutLoading(false);
                }
              }
            }}
          >
            {buttonLabel}
          </Button>

          {price !== -1 && (NEW_TIERS_WITH_ANNUAL as readonly string[]).includes(title) && (
            <Text
              fontSize="xs"
              color="blue.600"
              textAlign="center"
              mt={2}
              cursor="pointer"
              textDecoration="underline"
              _hover={{ color: "blue.700" }}
              onClick={onToggleBilling}
            >
              {isAnnual ? "View monthly billing" : "Save with annual billing"}
            </Text>
          )}

          <Box pt={4}>
            <List spacing={3} textAlign="left">
              {tokens !== -1 && (
                <ListItem display="flex" alignItems="flex-start" color="gray.600" fontSize="sm">
                  <ListIcon as={BsCheck} color="blue.500" boxSize={5} mr={3} mt={1} />
                  <Text>{tokens} tokens included (1 token = 1 minute of audio)</Text>
                </ListItem>
              )}
              {features.map((feature, index) => (
                <ListItem
                  key={index}
                  display="flex"
                  alignItems="flex-start"
                  color="gray.600"
                  fontSize="sm"
                >
                  <ListIcon as={BsCheck} color="blue.500" boxSize={5} mr={3} mt={1} />
                  <Text>{feature}</Text>
                </ListItem>
              ))}
            </List>
          </Box>
        </Stack>
      </Box>
    </Box>
  );
}
