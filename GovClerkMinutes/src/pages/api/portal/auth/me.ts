/**
 * GET /api/portal/auth/me
 * Returns the current portal session info, or 401 if no valid session.
 */

import { NextRequest } from "next/server";
import { errorResponse, jsonResponse } from "@/utils/apiHelpers";
import { getPortalSession } from "@/portal-auth/portalAuth";
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

  let role: string | undefined;
  if (session.authType === "email" && session.portalUserId) {
    const conn = getPortalDbConnection();
    const result = await conn.execute(
      "SELECT role FROM gc_portal_users WHERE id = ? AND is_active = 1",
      [session.portalUserId]
    );
    if (result.rows.length > 0) {
      role = (result.rows[0] as any).role;
    }
  }

  const response: PortalSessionResponse = {
    isAuthenticated: true,
    authType: session.authType,
    email: session.email ?? undefined,
    role: role as PortalSessionResponse["role"],
    orgId: session.orgId,
    expiresAt: session.expiresAt,
  };

  return jsonResponse(response);
}
