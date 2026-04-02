/**
 * Public Portal Email Verification Page
 *
 * Shown immediately after registration. The user enters the 6-digit code
 * that was emailed to them. On success they are redirected to the portal home.
 *
 * URL: /portal/[slug]/verify?email=[email]
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
import { makeDefaultPortalSettings } from "@/utils/defaultPortalSettings";

interface VerifyPageProps {
  settings: PublicPortalResponse["settings"];
  slug: string;
}

export default function PortalVerifyPage({ settings, slug }: VerifyPageProps) {
  const router = useRouter();
  const email = (router.query.email as string) || "";

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const accentColor = settings.accentColor || "#1e3a5f";
  const headerBg = settings.headerBgColor || "#1e3a5f";
  const headerText = settings.headerTextColor || "#ffffff";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const trimmed = code.replace(/\s/g, "");
    if (trimmed.length !== 6 || !/^\d{6}$/.test(trimmed)) {
      setError("Please enter a valid 6-digit verification code.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`/api/public/portal/${slug}/verify-email`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Verification failed. Please try again.");
        return;
      }
      // Verification successful — redirect to portal
      router.push(`/portal/${slug}`);
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResend() {
    setError(null);
    setSuccess(null);
    setIsResending(true);
    try {
      const res = await fetch(`/api/public/portal/${slug}/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to resend code. Please try again.");
        return;
      }
      setSuccess("A new code has been sent to your email.");
    } catch {
      setError("Failed to resend code. Please try again.");
    } finally {
      setIsResending(false);
    }
  }

  return (
    <>
      <Head>
        <title>Verify Your Email — {settings.pageTitle ?? "Portal"}</title>
      </Head>

      {/* Header */}
      <Box style={{ backgroundColor: headerBg }} py={4} px={6}>
        <HStack gap={4}>
          {settings.logoUrl && (
            <Box
              as="img"
              src={settings.logoUrl}
              alt=""
              style={{ height: 48, width: "auto", objectFit: "contain" }}
            />
          )}
          <Text fontWeight="bold" fontSize="xl" style={{ color: headerText }}>
            {settings.pageTitle ?? "Public Records Portal"}
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
                Check Your Email
              </Text>
              <Text fontSize="sm" color="gray.500" textAlign="center">
                We&apos;ve sent a 6-digit verification code to{" "}
                {email ? (
                  <Text as="span" fontWeight="medium" color="gray.700">
                    {email}
                  </Text>
                ) : (
                  "your email address"
                )}
                . Enter it below to complete your registration.
              </Text>
            </VStack>

            {error && (
              <Alert status="error" rounded="md" mb={4}>
                <AlertIcon />
                {error}
              </Alert>
            )}

            {success && (
              <Alert status="success" rounded="md" mb={4}>
                <AlertIcon />
                {success}
              </Alert>
            )}

            <form onSubmit={handleSubmit}>
              <VStack gap={4}>
                <FormControl isRequired>
                  <FormLabel fontSize="sm">Verification Code</FormLabel>
                  <Input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="123456"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    textAlign="center"
                    fontSize="xl"
                    letterSpacing="0.3em"
                  />
                  <FormHelperText fontSize="xs">
                    Enter the 6-digit code from your email
                  </FormHelperText>
                </FormControl>

                <Button
                  type="submit"
                  width="full"
                  isLoading={isLoading}
                  style={{ backgroundColor: accentColor, color: "#fff" }}
                >
                  Verify
                </Button>

                <HStack justify="center" pt={2}>
                  <Text fontSize="sm" color="gray.500">
                    Didn&apos;t receive a code?
                  </Text>
                  <Button
                    variant="link"
                    fontSize="sm"
                    color={accentColor}
                    isLoading={isResending}
                    onClick={handleResend}
                    type="button"
                  >
                    Resend Code
                  </Button>
                </HStack>
              </VStack>
            </form>
          </Box>
        </Box>
      </Box>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<VerifyPageProps> = async (context) => {
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
  } catch {
    // Network error — use default settings
  }

  return { props: { settings, slug } };
};
