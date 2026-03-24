import { createClerkClient } from "@clerk/nextjs/server";
import { getClerkKeys } from "./clerk";
import { isDev } from "./dev";
import { getSiteFromHeaders, type Site } from "./site";

// Accepts both Web API Headers (edge runtime) and Node IncomingHttpHeaders (node runtime)
export type RequestHeaders = Headers | Record<string, string | string[] | undefined>;

export type RequestContext = {
  userId: string;
  orgId: string | null;
  site: Site;
};

function extractSite(headers?: RequestHeaders, site?: Site): Site {
  if (site) {
    return site;
  }
  if (!headers) {
    return "GovClerkMinutes";
  }
  if (headers instanceof Headers) {
    return getSiteFromHeaders(headers);
  }
  return getSiteFromHeaders(headers);
}

export async function resolveRequestContext(
  userId: string | null,
  orgId?: string | null,
  headersOrSite?: RequestHeaders | Site
): Promise<RequestContext> {
  if (!userId) {
    throw new Error("Unauthorized: userId is required");
  }

  // Resolve site from headers or direct Site value
  const site: Site =
    typeof headersOrSite === "string" ? (headersOrSite as Site) : extractSite(headersOrSite);

  if (!orgId) {
    return { userId, orgId: null, site };
  }

  try {
    const clerkKeys = getClerkKeys(site);
    if (!clerkKeys.secretKey) {
      console.error("[resolveRequestContext] Clerk secret key is not configured");
      throw new Error("Clerk secret key is not configured");
    }
    const clerk = createClerkClient(clerkKeys);
    const orgMembership = await clerk.organizations.getOrganizationMembershipList({
      organizationId: orgId,
    });

    const isMember = orgMembership.data.some(
      (membership: any) => membership.publicUserData?.userId === userId
    );

    if (!isMember) {
      console.warn(
        `[resolveRequestContext] User ${userId} is NOT a member of organization ${orgId}`
      );
      throw new Error("User is not a member of the specified organization");
    }

    return { userId, orgId, site };
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "User is not a member of the specified organization"
    ) {
      throw error;
    }

    const isNetworkError =
      error instanceof Error &&
      (error.message.includes("fetch failed") ||
        error.message.includes("ECONNREFUSED") ||
        error.message.includes("ENOTFOUND") ||
        error.cause instanceof Error);

    if (isNetworkError && isDev()) {
      console.warn(
        "[resolveRequestContext] Network error verifying org membership in dev mode, allowing request:",
        { userId, orgId, error: error instanceof Error ? error.message : String(error) }
      );
      return { userId, orgId, site };
    }

    const errorMessage =
      error instanceof Error
        ? error.message || error.toString()
        : typeof error === "object"
          ? JSON.stringify(error)
          : String(error);

    console.error("[resolveRequestContext] Error verifying org membership:", {
      userId,
      orgId,
      errorType: error?.constructor?.name,
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });

    throw new Error(`Failed to verify organization membership: ${errorMessage || "Unknown error"}`);
  }
}
