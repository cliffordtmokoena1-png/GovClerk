import { assertString } from "@/utils/assert";

const VERIFY_TOKEN = "potatopotatopotato";

/**
 * Handle GET verification request from Meta. Returns Response if it is a
 * verification attempt, otherwise null so caller can continue normal flow.
 */
export function maybeHandleVerification(req: Request): Response | null {
  if (req.method !== "GET") {
    return null;
  }
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe") {
    if (!VERIFY_TOKEN) {
      return new Response("Server misconfigured", { status: 500 });
    }
    if (token !== VERIFY_TOKEN) {
      return new Response("Invalid verify token", { status: 403 });
    }
    // Per spec we must echo back hub.challenge exactly.
    return new Response(challenge ?? "", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }
  return null;
}

/** Compute HMAC SHA256 using Web Crypto (Edge runtime compatible). */
async function hmacSha256Hex(secret: string, payload: ArrayBuffer | string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const data = typeof payload === "string" ? enc.encode(payload) : new Uint8Array(payload);
  const signature = await crypto.subtle.sign("HMAC", key, data);
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Validates the X-Hub-Signature-256 header. Returns boolean; if env missing,
 * returns false (caller can decide to reject or allow). The header format is
 * 'sha256=hexhash'.
 */
export async function validateMetaSignature(
  req: Request,
  rawBody: string | ArrayBuffer
): Promise<boolean> {
  const header = req.headers.get("x-hub-signature-256") || req.headers.get("X-Hub-Signature-256");
  if (!header) {
    return false;
  }
  const parts = header.split("=");
  if (parts.length !== 2 || parts[0] !== "sha256") {
    return false;
  }
  const expected = await hmacSha256Hex(
    assertString(process.env.META_WHATSAPP_BUSINESS_WEBHOOK_SECRET),
    rawBody
  );
  // Time-safe comparison
  const provided = parts[1];
  if (provided.length !== expected.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < provided.length; i++) {
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

/** Safe JSON parse returning undefined on error. */
export function parseJsonSafe<T = any>(text: string): T | undefined {
  try {
    return JSON.parse(text) as T;
  } catch {
    return undefined;
  }
}
