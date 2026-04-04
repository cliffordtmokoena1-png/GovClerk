/**
 * Service Account Authentication Utility
 *
 * Allows the three AI agent personas (Gabriella, Gray, Samantha) to call
 * /api/admin/* endpoints directly using per-persona API keys stored as
 * environment variables — no Clerk browser session required.
 *
 * Compatible with both Node.js (NextApiRequest) and Edge (NextRequest) runtimes.
 * Does NOT use `fs` or any API unavailable in Edge.
 */

import { getAuth } from "@clerk/nextjs/server";
import type { NextApiRequest, NextApiResponse } from "next";
import type { NextRequest } from "next/server";

export type ServiceAccountPersona = "gabriella" | "gray" | "samantha";

export type ServiceAccountResult =
  | { valid: true; persona: ServiceAccountPersona; email: string }
  | { valid: false };

/**
 * Extract the raw API key from `Authorization: Bearer <key>` or `x-api-key: <key>` headers.
 * Works with both Edge (Headers.get) and Node.js (plain object) header shapes.
 */
function extractKey(headers: NextApiRequest["headers"] | Headers): string | null {
  let authorization: string | null = null;
  let xApiKey: string | null = null;

  if (typeof (headers as Headers).get === "function") {
    // Edge runtime — Web API Headers object
    const h = headers as Headers;
    authorization = h.get("authorization");
    xApiKey = h.get("x-api-key");
  } else {
    // Node.js runtime — IncomingHttpHeaders (plain object)
    const h = headers as NextApiRequest["headers"];
    const auth = h["authorization"];
    authorization = Array.isArray(auth) ? (auth[0] ?? null) : (auth ?? null);
    const apiKey = h["x-api-key"];
    xApiKey = Array.isArray(apiKey) ? (apiKey[0] ?? null) : (apiKey ?? null);
  }

  if (authorization) {
    const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
    if (match) return match[1].trim();
  }
  if (xApiKey) return xApiKey.trim();
  return null;
}

/**
 * Validate whether a request carries a recognised service account API key.
 * Returns persona + email on success, or `{ valid: false }` on no match.
 *
 * Keys are read from environment variables (never the database):
 *   GABRIELLA_API_KEY  → admin@govclerkminutes.com
 *   GRAY_API_KEY       → sales@govclerkminutes.com
 *   SAMANTHA_API_KEY   → support@govclerkminutes.com
 */
export function validateServiceAccountKey(
  req: NextApiRequest | NextRequest
): ServiceAccountResult {
  const key = extractKey(req.headers as NextApiRequest["headers"] | Headers);
  if (!key) return { valid: false };

  const gabriellaKey = process.env.GABRIELLA_API_KEY;
  const grayKey = process.env.GRAY_API_KEY;
  const samanthaKey = process.env.SAMANTHA_API_KEY;

  if (gabriellaKey && key === gabriellaKey) {
    return { valid: true, persona: "gabriella", email: "admin@govclerkminutes.com" };
  }
  if (grayKey && key === grayKey) {
    return { valid: true, persona: "gray", email: "sales@govclerkminutes.com" };
  }
  if (samanthaKey && key === samanthaKey) {
    return { valid: true, persona: "samantha", email: "support@govclerkminutes.com" };
  }

  return { valid: false };
}

// ---------------------------------------------------------------------------
// Higher-order wrapper types
// ---------------------------------------------------------------------------

type ServerlessHandler = (req: NextApiRequest, res: NextApiResponse) => Promise<void> | void;
type EdgeHandler = (req: NextRequest) => Promise<Response>;
type Handler = ServerlessHandler | EdgeHandler;

function isServerlessHandler(handler: Handler): handler is ServerlessHandler {
  return handler.length === 2;
}

/**
 * Higher-order wrapper that guards a handler with service-account OR Clerk admin auth.
 *
 * Auth resolution order:
 *   1. Service account API key (Authorization: Bearer / x-api-key) — no Clerk session needed.
 *   2. Clerk session with `sessionClaims.metadata.role === "admin"` — existing human admin path.
 *   3. Returns 401 if neither passes.
 *
 * Injects `x-service-account-persona` into the request headers when a service account key
 * is used, so downstream handlers can log which persona made the call.
 *
 * Works with both Node.js API routes (NextApiRequest/NextApiResponse) and
 * Edge runtime routes (NextRequest).
 */
export function withServiceAccountOrAdminAuth(handler: ServerlessHandler): ServerlessHandler;
export function withServiceAccountOrAdminAuth(handler: EdgeHandler): EdgeHandler;
export function withServiceAccountOrAdminAuth(handler: Handler): Handler {
  if (isServerlessHandler(handler)) {
    return async (req: NextApiRequest, res: NextApiResponse) => {
      // 1. Try service account key first
      const serviceAuth = validateServiceAccountKey(req);
      if (serviceAuth.valid) {
        console.log(
          `[serviceAccountAuth] Service account authenticated: persona=${serviceAuth.persona}`
        );
        // Inject persona for downstream logging (headers are mutable in Node.js)
        (req.headers as Record<string, string>)["x-service-account-persona"] =
          serviceAuth.persona;
        return handler(req, res);
      }

      // 2. Fall back to Clerk admin session
      const { userId, sessionClaims } = getAuth(req);
      if (userId && sessionClaims?.metadata?.role === "admin") {
        return handler(req, res);
      }

      return res.status(401).json({ error: "Unauthorized" });
    };
  } else {
    return async (req: NextRequest) => {
      // 1. Try service account key first
      const serviceAuth = validateServiceAccountKey(req);
      if (serviceAuth.valid) {
        console.log(
          `[serviceAccountAuth] Service account authenticated: persona=${serviceAuth.persona}`
        );
        // Inject persona header into a cloned request (Edge headers are immutable)
        const modifiedHeaders = new Headers(req.headers);
        modifiedHeaders.set("x-service-account-persona", serviceAuth.persona);
        const modifiedReq = new Request(req.url, {
          method: req.method,
          headers: modifiedHeaders,
          body: req.body,
          // @ts-expect-error — duplex is required for streaming bodies in some runtimes
          duplex: "half",
        });
        return (handler as EdgeHandler)(modifiedReq as NextRequest);
      }

      // 2. Fall back to Clerk admin session
      const { userId, sessionClaims } = getAuth(req);
      if (userId && sessionClaims?.metadata?.role === "admin") {
        return (handler as EdgeHandler)(req);
      }

      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    };
  }
}
