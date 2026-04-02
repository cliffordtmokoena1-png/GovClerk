/**
 * Higher-order function for protecting portal API routes.
 * Reads the portal session cookie and validates it.
 * Returns 401 if no valid session.
 *
 * Usage:
 *   export default requirePortalAuth(handler);
 *
 * The handler receives the session as a second argument.
 */
import { getPortalSession, PortalSessionPayload } from "./portalAuth";
import { errorResponse } from "@/utils/apiHelpers";
import { NextRequest } from "next/server";

type PortalHandler = (req: NextRequest, session: PortalSessionPayload) => Promise<Response>;

export function requirePortalAuth(handler: PortalHandler) {
  return async (req: NextRequest): Promise<Response> => {
    const session = await getPortalSession(req);
    if (!session) {
      return errorResponse("Unauthorized — please sign in to the portal", 401);
    }
    return handler(req, session);
  };
}
