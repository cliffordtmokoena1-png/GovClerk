/**
 * Higher-order function that wraps a portal API handler and ensures
 * the authenticated user's org has an active subscription.
 *
 * @govclerkminutes.com emails bypass this check and always access Live Portal features.
 *
 * Returns 403 with a clear message if no active subscription.
 *
 * Usage:
 *   export default requirePortalAuth(requireActiveSubscription(handler));
 *
 * The handler receives the session as a second argument (from requirePortalAuth).
 */

import { getPortalSession, isGovClerkAdmin, PortalSessionPayload } from "./portalAuth";
import { getPortalDbConnection } from "@/utils/portalDb";
import { errorResponse } from "@/utils/apiHelpers";
import { NextRequest } from "next/server";

type PortalHandler = (req: NextRequest, session: PortalSessionPayload) => Promise<Response>;

/** The 403 response returned when an active subscription is required. */
function subscriptionRequiredResponse(): Response {
  return new Response(
    JSON.stringify({
      error:
        "This feature requires an active subscription. Please subscribe to access the Live Portal.",
      code: "SUBSCRIPTION_REQUIRED",
    }),
    { status: 403, headers: { "Content-Type": "application/json" } }
  );
}

/** Queries the DB and returns true if the org has an active or trial subscription. */
async function orgHasActiveSubscription(orgId: string): Promise<boolean> {
  const conn = getPortalDbConnection();
  const result = await conn.execute(
    "SELECT id FROM gc_portal_subscriptions WHERE org_id = ? AND status IN ('active', 'trial') LIMIT 1",
    [orgId]
  );
  return result.rows.length > 0;
}

/**
 * Wraps a portal API handler and enforces that the org has an active or trial
 * subscription before allowing access. GovClerk admins (@govclerkminutes.com)
 * bypass this check.
 */
export function requireActiveSubscription(handler: PortalHandler): PortalHandler {
  return async (req: NextRequest, session: PortalSessionPayload): Promise<Response> => {
    // GovClerk admins bypass subscription checks
    if (isGovClerkAdmin(session.email)) {
      return handler(req, session);
    }

    if (!(await orgHasActiveSubscription(session.orgId))) {
      return subscriptionRequiredResponse();
    }

    return handler(req, session);
  };
}

/**
 * Standalone middleware that checks for an active subscription without requiring
 * a pre-validated session (performs session validation itself).
 *
 * Returns 401 if unauthenticated, 403 if no active subscription.
 */
export function withActiveSubscription(
  handler: (req: NextRequest, session: PortalSessionPayload) => Promise<Response>
) {
  return async (req: NextRequest): Promise<Response> => {
    const session = await getPortalSession(req);
    if (!session) {
      return errorResponse("Unauthorized — please sign in to the portal", 401);
    }

    // GovClerk admins bypass subscription checks
    if (isGovClerkAdmin(session.email)) {
      return handler(req, session);
    }

    if (!(await orgHasActiveSubscription(session.orgId))) {
      return subscriptionRequiredResponse();
    }

    return handler(req, session);
  };
}
