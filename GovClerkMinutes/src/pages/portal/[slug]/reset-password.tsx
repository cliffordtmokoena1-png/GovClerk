/**
 * Public Portal Reset Password Page
 *
 * Allows portal users to set a new password using a token from the forgot-password email.
 * Reads `token` and optionally `email` from URL query params.
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
  Input,
  Text,
  VStack,
  HStack,
  Alert,
  AlertIcon,
} from "@chakra-ui/react";
import type { PublicPortalResponse } from "@/types/portal";
import { makeDefaultPortalSettings } from "@/utils/defaultPortalSettings";

interface ResetPasswordPageProps {
  settings: PublicPortalResponse["settings"];
  slug: string;
  initialEmail: string;
  token: string;
}

export default function PortalResetPasswordPage({
  settings,
  slug,
  initialEmail,
  token,
}: ResetPasswordPageProps) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accentColor = settings.accentColor || "#1e3a5f";
  const headerBg = settings.headerBgColor || "#1e3a5f";
  const headerText = settings.headerTextColor || "#ffffff";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/portal/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, email, token, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to reset password. Please try again.");
        return;
      }
      setSuccess(true);
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>Reset Password — {settings.pageTitle ?? "Portal"}</title>
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
                Reset Password
              </Text>
              <Text fontSize="sm" color="gray.500" textAlign="center">
                Enter your new password below
              </Text>
            </VStack>

            {success ? (
              <Alert status="success" rounded="md" flexDirection="column" gap={3}>
                <AlertIcon />
                <Text textAlign="center" fontSize="sm">
                  Your password has been reset successfully.
                </Text>
                <Link href={`/portal/${slug}/sign-in`}>
                  <Text fontSize="sm" color={accentColor} fontWeight="medium">
                    Sign In with New Password
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

                  {!token && (
                    <Alert status="warning" rounded="md">
                      <AlertIcon />
                      Invalid reset link. Please request a new one.
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

                  <FormControl isRequired>
                    <FormLabel fontSize="sm">New Password</FormLabel>
                    <Input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="new-password"
                    />
                  </FormControl>

                  <FormControl isRequired>
                    <FormLabel fontSize="sm">Confirm New Password</FormLabel>
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
                    isDisabled={!token}
                    style={{ backgroundColor: accentColor, color: "#fff" }}
                  >
                    Reset Password
                  </Button>

                  <Text fontSize="sm" color="gray.600" textAlign="center">
                    Didn&apos;t request this?{" "}
                    <Link href={`/portal/${slug}/forgot-password`}>
                      <Text as="span" color={accentColor} fontWeight="medium">
                        Request a new link
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

export const getServerSideProps: GetServerSideProps<ResetPasswordPageProps> = async (context) => {
  const { slug } = context.params as { slug: string };
  const { token = "", email = "" } = context.query as { token?: string; email?: string };
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

  return { props: { settings, slug, initialEmail: email, token } };
};
