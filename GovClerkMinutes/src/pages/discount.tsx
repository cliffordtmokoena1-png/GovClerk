import {
  Badge,
  Box,
  Button,
  Center,
  Heading,
  HStack,
  Input,
  FormControl,
  FormErrorMessage,
  Text,
  VStack,
  useToken,
  Link,
} from "@chakra-ui/react";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { getWebinarDetails } from "@/utils/webinar";
import MgHead from "@/components/MgHead";
import { withGsspErrorHandling } from "@/error/withErrorReporting";
import { useRouter } from "next/router";
import { NavBar } from "@/components/base/NavBar";

const DISCOUNT_THRESHOLD_MILLIS = 24 * 60 * 60 * 1000;

type Props = { expiryISO: string | null };

export const getServerSideProps = withGsspErrorHandling(async () => {
  const webinarDetails = await getWebinarDetails(2);
  if (!webinarDetails) {
    return { redirect: { destination: "/", permanent: false } };
  }

  const [nextWebinar, prevWebinar] = webinarDetails;
  const now = Date.now();

  const prevWindowEnd = new Date(prevWebinar.eventTime).getTime() + DISCOUNT_THRESHOLD_MILLIS;
  const nextWindowEnd = new Date(nextWebinar.eventTime).getTime() + DISCOUNT_THRESHOLD_MILLIS;

  if (now >= new Date(prevWebinar.eventTime).getTime() && now <= prevWindowEnd) {
    return { props: { expiryISO: new Date(prevWindowEnd).toISOString() } };
  }

  if (now >= new Date(nextWebinar.eventTime).getTime() && now <= nextWindowEnd) {
    return { props: { expiryISO: new Date(nextWindowEnd).toISOString() } };
  }

  return { props: { expiryISO: null } };
});

export default function DiscountPage({ expiryISO }: Props) {
  const expiryMs = expiryISO ? new Date(expiryISO).getTime() : undefined;
  const [remaining, setRemaining] = useState(expiryMs ? expiryMs - Date.now() : 0);
  const router = useRouter();

  useEffect(() => {
    if (!expiryMs) {
      return;
    }
    const id = setInterval(() => setRemaining(expiryMs - Date.now()), 1000);
    return () => clearInterval(id);
  }, [expiryMs]);

  const [bg1, bg2] = useToken("colors", ["blue.100", "orange.100"]);

  const total = Math.floor(remaining / 1000);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[\w.+-]+@\w+\.\w+$/.test(email)) {
      return setError("Enter a valid email");
    }
    setError("");
    const res = await fetch("/api/create-checkout-session-for-discount", {
      method: "POST",
      body: JSON.stringify({ email }),
    });

    if (res.status !== 200) {
      const { error } = await res.json();
      return setError(error);
    }

    const { url } = await res.json();
    router.push(url);
  };

  if (remaining <= 0) {
    return (
      <Center minH="100vh" bg="gray.50" p={8} flexDir="column" gap={5}>
        <Heading size="xl">Sorry — this offer has expired.</Heading>
        <Text fontSize="xl">
          Join our{" "}
          <Link href="/training" fontWeight="bold" color="blue.500">
            next free training
          </Link>{" "}
          for a special discount
        </Text>
      </Center>
    );
  }

  return (
    <>
      <MgHead noindex title="50% off GovClerkMinutes • Limited‑Time Offer" />
      <NavBar fromFbAd={false} />

      <Center minH="100vh" bgGradient={`linear(to-br, ${bg1}, ${bg2})`} p={6}>
        <MotionBox
          position="relative"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          w="full"
          maxW="2xl"
          bg="white"
          rounded="2xl"
          shadow="xl"
          py={10}
          px={{ base: 3, md: 10 }}
          textAlign="center"
        >
          <Badge
            position="absolute"
            top={3}
            left={3}
            colorScheme="red"
            px={3}
            py={1}
            variant="outline"
          >
            Limited‑Time Offer
          </Badge>

          <Heading size="2xl" mb={4}>
            Get 50% off
          </Heading>
          <Text fontSize={{ base: "lg", md: "xl" }} color="gray.700" mb={8}>
            Upgrade to a paid plan for half off your first month — exclusive to training attendees!
          </Text>

          <HStack
            justify="center"
            spacing={4}
            fontFamily="monospace"
            fontSize="4xl"
            mb={8}
            suppressHydrationWarning
          >
            <Time value={hrs} label="Hrs" />
            <Text fontSize="2xl">:</Text>
            <Time value={mins} label="Min" />
            <Text fontSize="2xl">:</Text>
            <Time value={secs} label="Sec" />
          </HStack>

          <AnimatePresence mode="wait">
            {!showForm ? (
              <MotionButton
                key="cta"
                size="lg"
                colorScheme="orange"
                px={10}
                py={6}
                borderRadius="2xl"
                onClick={() => setShowForm(true)}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
              >
                Claim My Discount
              </MotionButton>
            ) : (
              <MotionBox
                key="form"
                as="form"
                onSubmit={submit}
                w="full"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
              >
                <VStack spacing={4} maxW="md" mx="auto">
                  <FormControl isInvalid={!!error}>
                    <Input
                      size="lg"
                      name="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                    {error && <FormErrorMessage>{error}</FormErrorMessage>}
                  </FormControl>
                  <Button type="submit" size="lg" colorScheme="orange" w="full" borderRadius="2xl">
                    Claim My Discount
                  </Button>
                </VStack>
              </MotionBox>
            )}
          </AnimatePresence>

          <Text mt={6} fontSize="sm" color="gray.500">
            Offer expires{" "}
            {new Date(expiryMs ?? new Date()).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </Text>
        </MotionBox>
      </Center>
    </>
  );
}

const MotionBox = motion(Box);
const MotionButton = motion(Button);

const Time = ({ value, label }: { value: number; label: string }) => (
  <VStack spacing={0} suppressHydrationWarning>
    <Text suppressHydrationWarning>{value.toString().padStart(2, "0")}</Text>
    <Text fontSize="xs" textTransform="uppercase" color="gray.500">
      {label}
    </Text>
  </VStack>
);
