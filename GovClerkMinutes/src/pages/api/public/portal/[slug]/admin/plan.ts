/**
 * Portal-session-authenticated subscription plan endpoint.
 *
 * GET /api/public/portal/[slug]/admin/plan — Returns current subscription details.
 *
 * Only portal users with role='admin' may access this endpoint.
 * If no subscription row exists for the org, defaults to Starter tier limits.
 */

import { NextRequest } from "next/server";
import { getPortalDbConnection } from "@/utils/portalDb";
import { getPortalSession, isGovClerkAdmin } from "@/portal-auth/portalAuth";
import { jsonResponse, errorResponse } from "@/utils/apiHelpers";
import { PORTAL_PAYSTACK_PLANS } from "@/utils/portalPaystack";

export const config = {
  runtime: "edge",
};

export default async function handler(req: NextRequest): Promise<Response> {
  if (req.method !== "GET") {
    return errorResponse("Method not allowed", 405);
  }

  // Validate portal session
  const session = await getPortalSession(req);
  if (!session) {
    return errorResponse("Unauthorized", 401);
  }

  // Extract slug from URL path: /api/public/portal/[slug]/admin/plan
  const url = new URL(req.url);
  const pathParts = url.pathname.split("/");
  const portalIndex = pathParts.indexOf("portal");
  const slug = portalIndex >= 0 ? pathParts[portalIndex + 1] : null;

  if (!slug) {
    return errorResponse("Portal slug is required", 400);
  }

  const conn = getPortalDbConnection();

  // Verify slug matches session orgId
  const settingsResult = await conn.execute(
    "SELECT org_id FROM gc_portal_settings WHERE slug = ? AND is_enabled = 1",
    [slug]
  );
  if (settingsResult.rows.length === 0) {
    return errorResponse("Portal not found", 404);
  }
  const orgId = (settingsResult.rows[0] as any).org_id;

  // GovClerk admins bypass all org and role checks
  if (!isGovClerkAdmin(session.email)) {
    if (orgId !== session.orgId) {
      return errorResponse("Forbidden", 403);
    }

    // Check that the requesting portal user has admin role
    if (!session.portalUserId) {
      return errorResponse("Admin access required", 403);
    }
    const userResult = await conn.execute(
      "SELECT role FROM gc_portal_users WHERE id = ? AND org_id = ?",
      [session.portalUserId, orgId]
    );
    if (userResult.rows.length === 0) {
      return errorResponse("User not found", 404);
    }
    if ((userResult.rows[0] as any).role !== "admin") {
      return errorResponse("Admin role required", 403);
    }
  }

  // Fetch subscription details; fall back to Starter defaults if no row exists
  const subResult = await conn.execute(
    `SELECT tier, seats_included, seats_used, stream_hours_included, stream_hours_used,
            monthly_price_zar, status, trial_ends_at, current_period_end
     FROM gc_portal_subscriptions
     WHERE org_id = ?`,
    [orgId]
  );

  if (subResult.rows.length === 0) {
    // No subscription row — return Starter defaults
    return jsonResponse({
      tier: "starter",
      seatsIncluded: PORTAL_PAYSTACK_PLANS.starter.seats,
      seatsUsed: 0,
      streamHoursIncluded: PORTAL_PAYSTACK_PLANS.starter.stream_hours,
      streamHoursUsed: 0,
      monthlyPriceZar: PORTAL_PAYSTACK_PLANS.starter.monthly_zar,
      status: "trial",
      trialEndsAt: null,
      currentPeriodEnd: null,
    });
  }

  const sub = subResult.rows[0] as any;
  return jsonResponse({
    tier: sub.tier,
    seatsIncluded: Number(sub.seats_included),
    seatsUsed: Number(sub.seats_used),
    streamHoursIncluded: Number(sub.stream_hours_included),
    streamHoursUsed: Number(sub.stream_hours_used),
    monthlyPriceZar: Number(sub.monthly_price_zar),
    status: sub.status,
    trialEndsAt: sub.trial_ends_at ?? null,
    currentPeriodEnd: sub.current_period_end ?? null,
  });
}
