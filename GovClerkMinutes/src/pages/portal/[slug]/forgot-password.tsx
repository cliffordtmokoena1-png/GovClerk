/**
 * Public Portal Forgot Password Page
 *
 * Allows portal users to request a password reset email.
 * Always shows a success message after submission to prevent email enumeration.
 */

import { useState } from "react";
import { GetServerSideProps } from "next";
import { RESERVED_PORTAL_SLUGS } from "@/pages/api/portal/utils/initializePortalSettings";
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
} from "@chakra-ui/react";
import type { PublicPortalResponse } from "@/types/portal";
import { makeDefaultPortalSettings } from "@/utils/defaultPortalSettings";

interface ForgotPasswordPageProps {
  settings: PublicPortalResponse["settings"];
  slug: string;
}

export default function PortalForgotPasswordPage({ settings, slug }: ForgotPasswordPageProps) {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accentColor = settings.accentColor || "#1e3a5f";
  const headerBg = settings.headerBgColor || "#1e3a5f";
  const headerText = settings.headerTextColor || "#ffffff";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await fetch("/api/portal/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, email }),
      });
      // Always show success regardless of outcome to prevent email enumeration
      setSubmitted(true);
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>Forgot Password — {settings.pageTitle ?? "Portal"}</title>
      </Head>

      {/* Header */}
      <Box style={{ backgroundColor: headerBg }} py={4} px={6}>
        <HStack gap={4}>
          {settings.logoUrl && (
            <Box
              as="img"
              src={settings.logoUrl}
              alt=""
              style={{ height: 52, width: "auto", objectFit: "contain" }}
            />
          )}
          <Text fontWeight="bold" fontSize="2xl" style={{ color: headerText }}>
            {settings.pageTitle ?? "Public Records Portal"}
          </Text>
        </HStack>
      </Box>

      <Box minH="100vh" bg="gray.50" py={10} px={4}>
        <Box maxW="420px" mx="auto">
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
                Forgot Password
              </Text>
              <Text fontSize="sm" color="gray.500" textAlign="center">
                Enter your work email and we&apos;ll send you a reset link
              </Text>
            </VStack>

            {submitted ? (
              <Alert status="success" rounded="md" flexDirection="column" gap={3}>
                <AlertIcon />
                <Text textAlign="center" fontSize="sm">
                  If an account exists with that email, we&apos;ve sent password reset
                  instructions.
                </Text>
                <Link href={`/portal/${slug}/sign-in`}>
                  <Text fontSize="sm" color={accentColor} fontWeight="medium">
                    Back to Sign In
                  </Text>
                </Link>
              </Alert>
            ) : (
              <form onSubmit={handleSubmit}>
                <VStack gap={4}>
                  {error && (
                    <Alert status="error" rounded="md">
                      <AlertIcon />
                      {error}
                    </Alert>
                  )}

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

                  <Button
                    type="submit"
                    width="full"
                    isLoading={isLoading}
                    style={{ backgroundColor: accentColor, color: "#fff" }}
                  >
                    Send Reset Link
                  </Button>

                  <Text fontSize="sm" color="gray.600" textAlign="center">
                    Remember your password?{" "}
                    <Link href={`/portal/${slug}/sign-in`}>
                      <Text as="span" color={accentColor} fontWeight="medium">
                        Sign In
                      </Text>
                    </Link>
                  </Text>
                </VStack>
              </form>
            )}
          </Box>
        </Box>
      </Box>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<ForgotPasswordPageProps> = async (context) => {
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
  } catch {
    // Network error — use default settings
  }

  return { props: { settings, slug } };
};
