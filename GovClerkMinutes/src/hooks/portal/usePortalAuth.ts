/**
 * Hook to check the current user's authentication status for a portal.
 *
 * Returns:
 * - isAuthenticated: true if the user has a valid portal session
 * - email: the user's email address (if authenticated)
 * - authType: "email" | "shared" | null
 * - isLoading: true while the auth status is being fetched
 * - hasActiveSubscription: true if the org has an active or trial subscription
 * - isGovClerkAdmin: true if the email ends with @govclerkminutes.com
 * - portalMode: "live" | "demo" — determines which portal experience to render
 */

import useSWR from "swr";

interface PortalAuthStatus {
  isAuthenticated: boolean;
  email: string | null;
  authType: "email" | "shared" | null;
  hasActiveSubscription?: boolean;
  subscriptionTier?: string;
  isGovClerkAdmin?: boolean;
  portalMode?: "live" | "demo";
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function usePortalAuth(slug: string | undefined) {
  const { data, isLoading, error } = useSWR<PortalAuthStatus>(
    slug ? `/api/public/portal/${slug}/auth-status` : null,
    fetcher,
    { revalidateOnFocus: true, refreshInterval: 30000 }
  );

  return {
    isAuthenticated: data?.isAuthenticated ?? false,
    email: data?.email ?? null,
    authType: data?.authType ?? null,
    hasActiveSubscription: data?.hasActiveSubscription ?? false,
    subscriptionTier: data?.subscriptionTier ?? null,
    isGovClerkAdmin: data?.isGovClerkAdmin ?? false,
    portalMode: data?.portalMode ?? null,
    isLoading,
    error,
  };
}
