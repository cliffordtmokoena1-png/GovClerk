/**
 * Hook to check the current user's authentication status for a portal.
 *
 * Returns:
 * - isAuthenticated: true if the user has a valid portal session
 * - email: the user's email address (if authenticated)
 * - authType: "email" | "shared" | null
 * - isLoading: true while the auth status is being fetched
 */

import useSWR from "swr";

interface PortalAuthStatus {
  isAuthenticated: boolean;
  email: string | null;
  authType: "email" | "shared" | null;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function usePortalAuth(slug: string | undefined) {
  const { data, isLoading, error } = useSWR<PortalAuthStatus>(
    slug ? `/api/public/portal/${slug}/auth-status` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  return {
    isAuthenticated: data?.isAuthenticated ?? false,
    email: data?.email ?? null,
    authType: data?.authType ?? null,
    isLoading,
    error,
  };
}
