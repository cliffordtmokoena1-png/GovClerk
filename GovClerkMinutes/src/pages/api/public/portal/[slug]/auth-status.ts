/**
 * GET /api/public/portal/[slug]/auth-status
 * Returns the current user's authentication status for the given portal.
 *
 * Used by the frontend to determine whether to show content or a sign-in prompt.
 */

import { NextRequest } from "next/server";
import { getPortalDbConnection } from "@/utils/portalDb";
import { getPortalSession, isGovClerkAdmin } from "@/portal-auth/portalAuth";
import { jsonResponse, errorResponse } from "@/utils/apiHelpers";

export const config = {
  runtime: "edge",
};

export default async function handler(req: NextRequest): Promise<Response> {
  if (req.method !== "GET") {
    return errorResponse("Method not allowed", 405);
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/");
  // Path: /api/public/portal/[slug]/auth-status
  const authStatusIndex = pathParts.indexOf("auth-status");
  const slug = authStatusIndex > 0 ? pathParts[authStatusIndex - 1] : null;

  if (!slug) {
    return errorResponse("Portal slug is required", 400);
  }

  const conn = getPortalDbConnection();

  // Look up portal by slug
  const settingsResult = await conn.execute(
    "SELECT org_id FROM gc_portal_settings WHERE slug = ? AND is_enabled = 1",
    [slug]
  );
  if (settingsResult.rows.length === 0) {
    return errorResponse("Portal not found", 404);
  }

  // Check session
  const session = await getPortalSession(req);
  if (!session) {
    return jsonResponse({ isAuthenticated: false, email: null, authType: null });
  }

  // Check GovClerk admin status
  const govClerkAdmin = isGovClerkAdmin(session.email);

  // Check for active subscription
  const subResult = await conn.execute(
    "SELECT tier, status FROM gc_portal_subscriptions WHERE org_id = ? AND status IN ('active', 'trial') LIMIT 1",
    [session.orgId]
  );

  const hasActiveSubscription = subResult.rows.length > 0;
  const subscriptionTier = hasActiveSubscription
    ? ((subResult.rows[0] as any).tier as string)
    : undefined;

  // Determine portal mode
  const portalMode: "live" | "demo" =
    govClerkAdmin || hasActiveSubscription ? "live" : "demo";

  return jsonResponse({
    isAuthenticated: true,
    email: session.email,
    authType: session.authType,
    hasActiveSubscription,
    subscriptionTier,
    isGovClerkAdmin: govClerkAdmin,
    portalMode,
  });
}
