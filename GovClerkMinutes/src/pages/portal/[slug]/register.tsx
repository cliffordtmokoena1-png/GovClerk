/**
 * Public Portal Registration Page
 *
 * Allows staff/council members to create an account using their work email.
 * Any organisational email (i.e. not a free/personal provider) is accepted.
 *
 * After successful registration, auto-login redirects to the portal.
 */

import { useState } from "react";
import { GetServerSideProps } from "next";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  FormHelperText,
  Input,
  Text,
  VStack,
  HStack,
  Alert,
  AlertIcon,
} from "@chakra-ui/react";
import type { PublicPortalResponse } from "@/types/portal";
import { isFreeEmailProvider } from "@/utils/freeEmailProviders";
import { makeDefaultPortalSettings } from "@/utils/defaultPortalSettings";

interface RegisterPageProps {
  settings: PublicPortalResponse["settings"];
  slug: string;
}

export default function PortalRegisterPage({ settings, slug }: RegisterPageProps) {
  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const accentColor = settings.accentColor || "#1e3a5f";
  const headerBg = settings.headerBgColor || "#1e3a5f";
  const headerText = settings.headerTextColor || "#ffffff";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Client-side: catch obvious free/personal email addresses early
    if (isFreeEmailProvider(email)) {
      setError(
        "This portal requires an organisational email address. Personal email addresses (Gmail, Yahoo, Outlook, etc.) are not accepted. If you belong to an organisation, please use your work email."
      );
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/portal/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, email, password, firstName, lastName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Registration failed. Please try again.");
        return;
      }
      // Redirect to verification page so the user can enter their emailed code
      router.push(`/portal/${slug}/verify?email=${encodeURIComponent(email)}`);
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>Create Account — {settings.pageTitle ?? "Portal"}</title>
      </Head>

      {/* Header */}
      <Box style={{ backgroundColor: headerBg }} py={4} px={6}>
        <HStack gap={3}>
          <Box
            as="img"
            src="/govclerk-logo.svg"
            alt="GovClerk"
            style={{ height: 36, width: "auto", objectFit: "contain" }}
          />
          <Text fontWeight="bold" fontSize="xl" style={{ color: headerText }}>
            Portal
          </Text>
        </HStack>
      </Box>

      <Box minH="100vh" bg="gray.50" py={10} px={4}>
        <Box maxW="480px" mx="auto">
          {/* Back link */}
          <Box mb={6}>
            <Link href={`/portal/${slug}/sign-in`}>
              <Text fontSize="sm" color="gray.600" _hover={{ color: "gray.900" }}>
                ← Back to Sign In
              </Text>
            </Link>
          </Box>

          <Box bg="white" rounded="xl" shadow="md" p={8}>
            <VStack gap={2} mb={6} align="center">
              <Text fontSize="2xl" fontWeight="bold" color="gray.900">
                Create Account
              </Text>
              <Text fontSize="sm" color="gray.500" textAlign="center">
                For {settings.pageTitle ?? "portal"} staff and council members
              </Text>
              <Text fontSize="xs" color="gray.400" textAlign="center">
                An organisational (work) email address is required
              </Text>
            </VStack>

            {error && (
              <Alert status="error" rounded="md" mb={4}>
                <AlertIcon />
                {error}
              </Alert>
            )}

            <form onSubmit={handleSubmit}>
              <VStack gap={4}>
                <HStack gap={3} width="full">
                  <FormControl>
                    <FormLabel fontSize="sm">First Name</FormLabel>
                    <Input
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Jane"
                      autoComplete="given-name"
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel fontSize="sm">Last Name</FormLabel>
                    <Input
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Smith"
                      autoComplete="family-name"
                    />
                  </FormControl>
                </HStack>

                <FormControl isRequired>
                  <FormLabel fontSize="sm">Work Email</FormLabel>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@organisation.gov"
                    autoComplete="email"
                  />
                  <FormHelperText fontSize="xs">
                    Use your organisational (work) email — personal addresses are not accepted
                  </FormHelperText>
                </FormControl>

                <FormControl isRequired>
                  <FormLabel fontSize="sm">Password</FormLabel>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    autoComplete="new-password"
                  />
                </FormControl>

                <FormControl isRequired>
                  <FormLabel fontSize="sm">Confirm Password</FormLabel>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                </FormControl>

                <Button
                  type="submit"
                  width="full"
                  isLoading={isLoading}
                  style={{ backgroundColor: accentColor, color: "#fff" }}
                >
                  Create Account
                </Button>

                <Text fontSize="sm" color="gray.600" textAlign="center">
                  Already have an account?{" "}
                  <Link href={`/portal/${slug}/sign-in`}>
                    <Text as="span" color={accentColor} fontWeight="medium">
                      Sign In
                    </Text>
                  </Link>
                </Text>
              </VStack>
            </form>
          </Box>
        </Box>
      </Box>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<RegisterPageProps> = async (context) => {
  const { slug } = context.params as { slug: string };
  const host = context.req.headers.host || "localhost:3000";
  const isLocalhost = host.includes("localhost") || host.includes("127.0.0.1");
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${isLocalhost ? "http" : "https"}://${host}`;

  let settings = makeDefaultPortalSettings(slug);
  try {
    const res = await fetch(`${baseUrl}/api/public/portal/${slug}`);
    if (res.ok) {
      const data: PublicPortalResponse = await res.json();
      settings = data.settings;
    }
    // If not ok (including 404), fall through with default settings
  } catch {
    // Network error — use default settings
  }

  return { props: { settings, slug } };
};
