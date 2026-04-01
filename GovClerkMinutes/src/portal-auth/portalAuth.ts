/**
 * Portal authentication utilities.
 *
 * Provides session creation, validation, and password hashing
 * for the portal-specific auth system (independent of Clerk).
 *
 * Uses the Web Crypto API (available in Edge runtime) for:
 * - Password hashing: PBKDF2
 * - Session token: random hex via crypto.getRandomValues
 */

import { getPortalDbConnection } from "@/utils/portalDb";

// Session duration: 8 hours for email sessions, 24 hours for shared password sessions
const EMAIL_SESSION_HOURS = 8;
const SHARED_SESSION_HOURS = 24;

/** Cookie name used for portal auth session token. */
export const PORTAL_SESSION_COOKIE = "gcportal_session";

export interface PortalSessionPayload {
  sessionId: string;
  orgId: string;
  portalUserId: number | null;
  sharedPasswordId: number | null;
  email: string | null;
  authType: "email" | "shared";
  expiresAt: string;
}

/** Generate a cryptographically random hex session ID (32 bytes = 64 hex chars). */
export function generateSessionId(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** Hash a password using PBKDF2-SHA256 via Web Crypto API. Returns a storable string. */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const saltBytes = new Uint8Array(16);
  crypto.getRandomValues(saltBytes);
  const salt = Array.from(saltBytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: encoder.encode(salt),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );

  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `pbkdf2:${salt}:${hashHex}`;
}

/** Verify a password against a stored hash. */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split(":");
  if (parts.length !== 3 || parts[0] !== "pbkdf2") {
    return false;
  }

  const [, salt, expectedHex] = parts;
  const encoder = new TextEncoder();

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: encoder.encode(salt),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );

  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((byte) => byte.toString(16).padStart(2, "0")).join("");

  // Constant-time comparison to prevent timing attacks
  // Always compare all characters even if lengths differ
  const maxLen = Math.max(hashHex.length, expectedHex.length);
  let diff = hashHex.length !== expectedHex.length ? 1 : 0;
  for (let i = 0; i < maxLen; i++) {
    diff |= (hashHex.charCodeAt(i) || 0) ^ (expectedHex.charCodeAt(i) || 0);
  }
  return diff === 0;
}

/** Extract the portal session from a request's cookies. Returns null if not present or expired. */
export async function getPortalSession(
  req: Request
): Promise<PortalSessionPayload | null> {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const cookies = Object.fromEntries(
    cookieHeader.split(";").map((part) => {
      const [key, ...rest] = part.trim().split("=");
      return [key.trim(), decodeURIComponent(rest.join("="))];
    })
  );

  const sessionId = cookies[PORTAL_SESSION_COOKIE];
  if (!sessionId) {
    return null;
  }

  const conn = getPortalDbConnection();
  const result = await conn.execute(
    `SELECT id, org_id, portal_user_id, shared_password_id, email, auth_type, expires_at
     FROM gc_portal_sessions
     WHERE id = ? AND expires_at > UTC_TIMESTAMP()`,
    [sessionId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0] as any;
  return {
    sessionId: row.id,
    orgId: row.org_id,
    portalUserId: row.portal_user_id ?? null,
    sharedPasswordId: row.shared_password_id ?? null,
    email: row.email ?? null,
    authType: row.auth_type,
    expiresAt: row.expires_at,
  };
}

/** Create a new portal session in the database and return a Set-Cookie header value. */
export async function createPortalSession({
  orgId,
  portalUserId,
  sharedPasswordId,
  email,
  authType,
}: {
  orgId: string;
  portalUserId?: number | null;
  sharedPasswordId?: number | null;
  email?: string | null;
  authType: "email" | "shared";
}): Promise<{ sessionId: string; cookieValue: string }> {
  const sessionId = generateSessionId();
  const hours = authType === "shared" ? SHARED_SESSION_HOURS : EMAIL_SESSION_HOURS;

  const conn = getPortalDbConnection();
  await conn.execute(
    `INSERT INTO gc_portal_sessions
       (id, org_id, portal_user_id, shared_password_id, email, auth_type, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? HOUR))`,
    [
      sessionId,
      orgId,
      portalUserId ?? null,
      sharedPasswordId ?? null,
      email ?? null,
      authType,
      hours,
    ]
  );

  const maxAge = hours * 60 * 60;
  const cookieValue = `${PORTAL_SESSION_COOKIE}=${sessionId}; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}; Path=/`;

  return { sessionId, cookieValue };
}

/** Destroy a portal session (logout). */
export async function destroyPortalSession(sessionId: string): Promise<void> {
  const conn = getPortalDbConnection();
  await conn.execute("DELETE FROM gc_portal_sessions WHERE id = ?", [sessionId]);
}

/**
 * Extract and validate the portal session using a raw cookie header string.
 * Use this in getServerSideProps (Node.js runtime) where the request is an
 * IncomingMessage rather than a Web Fetch API Request.
 */
export async function getPortalSessionFromCookieHeader(
  cookieHeader: string | undefined
): Promise<PortalSessionPayload | null> {
  const header = cookieHeader ?? "";
  if (!header) {
    return null;
  }

  const cookies = Object.fromEntries(
    header.split(";").map((part) => {
      const [key, ...rest] = part.trim().split("=");
      return [key.trim(), decodeURIComponent(rest.join("="))];
    })
  );

  const sessionId = cookies[PORTAL_SESSION_COOKIE];
  if (!sessionId) {
    return null;
  }

  const conn = getPortalDbConnection();
  const result = await conn.execute(
    `SELECT id, org_id, portal_user_id, shared_password_id, email, auth_type, expires_at
     FROM gc_portal_sessions
     WHERE id = ? AND expires_at > UTC_TIMESTAMP()`,
    [sessionId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0] as any;
  return {
    sessionId: row.id,
    orgId: row.org_id,
    portalUserId: row.portal_user_id ?? null,
    sharedPasswordId: row.shared_password_id ?? null,
    email: row.email ?? null,
    authType: row.auth_type,
    expiresAt: row.expires_at,
  };
}

/** Check if an email domain is allowed for a given org. */
export async function isEmailDomainAllowed(orgId: string, email: string): Promise<boolean> {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) {
    return false;
  }

  const conn = getPortalDbConnection();
  const result = await conn.execute(
    "SELECT id FROM gc_portal_org_domains WHERE org_id = ? AND domain = ? AND is_active = 1",
    [orgId, domain]
  );

  return result.rows.length > 0;
}
