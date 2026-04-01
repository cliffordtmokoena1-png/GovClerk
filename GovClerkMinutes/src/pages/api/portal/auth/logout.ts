/**
 * POST /api/portal/auth/logout
 * Destroys the current portal session and clears the session cookie.
 */

import { NextRequest } from "next/server";
import { errorResponse, jsonResponse } from "@/utils/apiHelpers";
import { PORTAL_SESSION_COOKIE, destroyPortalSession } from "@/portal-auth/portalAuth";

export const config = {
  runtime: "edge",
};

export default async function handler(req: NextRequest): Promise<Response> {
  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  const cookieHeader = req.headers.get("cookie") ?? "";
  const cookies = Object.fromEntries(
    cookieHeader.split(";").map((part) => {
      const [key, ...rest] = part.trim().split("=");
      return [key.trim(), decodeURIComponent(rest.join("="))];
    })
  );

  const sessionId = cookies[PORTAL_SESSION_COOKIE];
  if (sessionId) {
    await destroyPortalSession(sessionId);
  }

  const clearCookie = `${PORTAL_SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/`;

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": clearCookie,
    },
  });
}
