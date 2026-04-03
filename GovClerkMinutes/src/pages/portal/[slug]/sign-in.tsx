/**
 * Public Portal Sign-In Page
 *
 * Separate from GovClerkMinutes sign-in.
 * Two modes:
 * 1. Individual work email + password (tab: "Work Email")
 * 2. Shared organisation password (tab: "Organisation Access")
 *
 * After successful login, redirects to /portal/[slug] (or ?redirect= param).
 */

import { useState } from "react";
import { GetServerSideProps } from "next";
import { RESERVED_PORTAL_SLUGS } from "@/pages/api/portal/utils/initializePortalSettings";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Input,
  Text,
  VStack,
  HStack,
  Alert,
  AlertIcon,
  Divider,
  Spinner,
  Center,
} from "@chakra-ui/react";
import type { PublicPortalResponse } from "@/types/portal";
import { makeDefaultPortalSettings } from "@/utils/defaultPortalSettings";

interface SignInPageProps {
  settings: PublicPortalResponse["settings"];
  slug: string;
}

type TabType = "email" | "shared";

export default function PortalSignInPage({ settings, slug }: SignInPageProps) {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabType>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sharedPassword, setSharedPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const accentColor = settings.accentColor || "#1e3a5f";
  const headerBg = settings.headerBgColor || "#1e3a5f";
  const headerText = settings.headerTextColor || "#ffffff";

  async function getPortalModeRedirect(): Promise<string> {
    try {
      const res = await fetch(`/api/public/portal/${slug}/auth-status`);
      if (res.ok) {
        const data = await res.json();
        if (data.portalMode === "live") return `/portal/${slug}`;
      }
    } catch {
      // ignore — fall back to trial
    }
    return `/portal/${slug}/trial`;
  }

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const res = await fetch("/api/portal/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Sign in failed. Please try again.");
        return;
      }
      const destination = await getPortalModeRedirect();
      router.push(destination);
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSharedLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const res = await fetch("/api/portal/auth/shared-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, password: sharedPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Access denied. Please check the password and try again.");
        return;
      }
      const destination = await getPortalModeRedirect();
      router.push(destination);
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>Sign In — {settings.pageTitle ?? "Portal"}</title>
      </Head>

      {/* Header */}
      <Box style={{ backgroundColor: headerBg }} py={4} px={6}>
        <HStack gap={3}>
          <Box
            as="img"
            src="/govclerk-logo.svg"
            alt="GovClerk"
            style={{ height: 52, width: "auto", objectFit: "contain" }}
          />
          <Text fontWeight="bold" fontSize="2xl" style={{ color: headerText }}>
            Portal
          </Text>
        </HStack>
      </Box>

      <Box minH="100vh" bg="gray.50" py={10} px={4}>
        <Box maxW="420px" mx="auto">
          {/* Back link */}
          <Box mb={6}>
            <Link href={`/portal/${slug}`}>
              <Text fontSize="sm" color="gray.600" _hover={{ color: "gray.900" }}>
                ← Back to Portal
              </Text>
            </Link>
          </Box>

          <Box bg="white" rounded="xl" shadow="md" p={8}>
            <VStack gap={2} mb={6} align="center">
              <Text fontSize="2xl" fontWeight="bold" color="gray.900">
                Portal Sign In
              </Text>
              <Text fontSize="sm" color="gray.500" textAlign="center">
                This is separate from your GovClerkMinutes account
              </Text>
            </VStack>

            {/* Tab switcher */}
            <HStack mb={6} bg="gray.100" rounded="lg" p={1}>
              <Button
                flex={1}
                size="sm"
                variant={activeTab === "email" ? "solid" : "ghost"}
                style={activeTab === "email" ? { backgroundColor: accentColor, color: "#fff" } : {}}
                onClick={() => {
                  setActiveTab("email");
                  setError(null);
                }}
              >
                Work Email
              </Button>
              <Button
                flex={1}
                size="sm"
                variant={activeTab === "shared" ? "solid" : "ghost"}
                style={
                  activeTab === "shared" ? { backgroundColor: accentColor, color: "#fff" } : {}
                }
                onClick={() => {
                  setActiveTab("shared");
                  setError(null);
                }}
              >
                Organisation Access
              </Button>
            </HStack>

            {error && (
              <Alert status="error" rounded="md" mb={4}>
                <AlertIcon />
                {error}
              </Alert>
            )}

            {activeTab === "email" ? (
              <form onSubmit={handleEmailLogin}>
                <VStack gap={4}>
                  <FormControl isRequired>
                    <FormLabel fontSize="sm">Work Email</FormLabel>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@organisation.gov"
                      autoComplete="email"
                    />
                  </FormControl>

                  <FormControl isRequired>
                    <FormLabel fontSize="sm">Password</FormLabel>
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                    />
                  </FormControl>

                  <Box width="full" textAlign="right">
                    <Link href={`/portal/${slug}/forgot-password`}>
                      <Text fontSize="sm" color={accentColor} fontWeight="medium">
                        Forgot Password?
                      </Text>
                    </Link>
                  </Box>

                  <Button
                    type="submit"
                    width="full"
                    isLoading={isLoading}
                    style={{ backgroundColor: accentColor, color: "#fff" }}
                  >
                    Sign In
                  </Button>

                  <Divider />

                  <Text fontSize="sm" color="gray.600" textAlign="center">
                    Don&apos;t have an account?{" "}
                    <Link href={`/portal/${slug}/register`}>
                      <Text as="span" color={accentColor} fontWeight="medium">
                        Create Account
                      </Text>
                    </Link>
                  </Text>
                </VStack>
              </form>
            ) : (
              <form onSubmit={handleSharedLogin}>
                <VStack gap={4}>
                  <Text fontSize="sm" color="gray.600" textAlign="center">
                    Use the shared password provided by your organisation to access the portal.
                  </Text>

                  <FormControl isRequired>
                    <FormLabel fontSize="sm">Organisation Password</FormLabel>
                    <Input
                      type="password"
                      value={sharedPassword}
                      onChange={(e) => setSharedPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                    />
                  </FormControl>

                  <Button
                    type="submit"
                    width="full"
                    isLoading={isLoading}
                    style={{ backgroundColor: accentColor, color: "#fff" }}
                  >
                    Access Portal
                  </Button>
                </VStack>
              </form>
            )}
          </Box>
        </Box>
      </Box>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<SignInPageProps> = async (context) => {
  const { slug } = context.params as { slug: string };

  if (RESERVED_PORTAL_SLUGS.has(slug)) {
    return { notFound: true };
  }

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
