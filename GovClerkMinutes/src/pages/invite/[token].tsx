import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/router";
import {
  Flex,
  Spinner,
  Text,
  VStack,
  Button,
  Alert,
  AlertIcon,
  Heading,
} from "@chakra-ui/react";
import MgHead from "@/components/MgHead";

type Status = "loading" | "accepting" | "success" | "error" | "unauthorized";

export default function InviteAcceptPage() {
  const router = useRouter();
  const { token } = router.query as { token?: string };
  const { isLoaded, isSignedIn } = useUser();
  const [status, setStatus] = useState<Status>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!isLoaded || !token) return;

    if (!isSignedIn) {
      // Redirect to sign-in, then come back here
      router.push(`/sign-in?redirect_url=${encodeURIComponent(`/invite/${token}`)}`);
      return;
    }

    setStatus("accepting");

    fetch(`/api/team-members/accept?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) {
          setStatus("success");
          // Redirect to dashboard after a short delay
          setTimeout(() => {
            router.push("/dashboard");
          }, 2500);
        } else {
          setStatus("error");
          setErrorMessage(data.error ?? "Failed to accept invitation.");
        }
      })
      .catch(() => {
        setStatus("error");
        setErrorMessage("An unexpected error occurred. Please try again.");
      });
  }, [isLoaded, isSignedIn, token, router]);

  return (
    <>
      <MgHead title="Accept Invitation — GovClerk Minutes" noindex />
      <Flex w="100dvw" h="100dvh" alignItems="center" justifyContent="center">
        <VStack spacing={6} maxW="480px" w="full" px={6} textAlign="center">
          <Heading size="lg" color="#1a3c6e">
            GovClerk Minutes
          </Heading>

          {(status === "loading" || status === "accepting") && (
            <VStack spacing={3}>
              <Spinner size="lg" color="#1a3c6e" />
              <Text color="gray.600">
                {status === "loading" ? "Loading…" : "Accepting your invitation…"}
              </Text>
            </VStack>
          )}

          {status === "success" && (
            <Alert status="success" borderRadius="md">
              <AlertIcon />
              <Text>
                Invitation accepted! You now have access to the dashboard. Redirecting…
              </Text>
            </Alert>
          )}

          {status === "error" && (
            <VStack spacing={4} align="stretch">
              <Alert status="error" borderRadius="md">
                <AlertIcon />
                <Text>{errorMessage}</Text>
              </Alert>
              <Button
                colorScheme="blue"
                bg="#1a3c6e"
                onClick={() => router.push("/dashboard")}
              >
                Go to Dashboard
              </Button>
            </VStack>
          )}
        </VStack>
      </Flex>
    </>
  );
}
