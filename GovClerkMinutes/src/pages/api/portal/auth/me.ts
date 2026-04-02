/**
 * GET /api/portal/auth/me
 * Returns the current portal session info, or 401 if no valid session.
 */

import { NextRequest } from "next/server";
import { errorResponse, jsonResponse } from "@/utils/apiHelpers";
import { getPortalSession, isGovClerkAdmin } from "@/portal-auth/portalAuth";
import { getPortalDbConnection } from "@/utils/portalDb";
import type { PortalSessionResponse } from "@/types/portal";

export const config = {
  runtime: "edge",
};

export default async function handler(req: NextRequest): Promise<Response> {
  if (req.method !== "GET") {
    return errorResponse("Method not allowed", 405);
  }

  const session = await getPortalSession(req);
  if (!session) {
    const response: PortalSessionResponse = { isAuthenticated: false };
    return jsonResponse(response, 401);
  }

  const conn = getPortalDbConnection();

  let role: string | undefined;
  if (session.authType === "email" && session.portalUserId) {
    const result = await conn.execute(
      "SELECT role FROM gc_portal_users WHERE id = ? AND is_active = 1",
      [session.portalUserId]
    );
    if (result.rows.length > 0) {
      role = (result.rows[0] as any).role;
    }
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

  const portalMode: "live" | "demo" =
    govClerkAdmin || hasActiveSubscription ? "live" : "demo";

  const response: PortalSessionResponse = {
    isAuthenticated: true,
    authType: session.authType,
    email: session.email ?? undefined,
    role: role as PortalSessionResponse["role"],
    orgId: session.orgId,
    expiresAt: session.expiresAt,
    hasActiveSubscription,
    subscriptionTier,
    isGovClerkAdmin: govClerkAdmin,
    portalMode,
  };

  return jsonResponse(response);
}
