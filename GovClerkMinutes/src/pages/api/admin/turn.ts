import withErrorReporting from "@/error/withErrorReporting";

export const config = {
  runtime: "edge",
};

function toBase64(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let str = "";
  for (let i = 0; i < arr.length; i++) {
    str += String.fromCharCode(arr[i]);
  }
  // btoa is available in Edge runtime
  return btoa(str);
}

async function hmacSha1Base64(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return toBase64(sig);
}

async function handler(req: Request): Promise<Response> {
  const ttlSec = 3600;
  const domain = process.env.TURN_DOMAIN || "turn.GovClerkMinutes.com";
  const tlsPort = Number(process.env.TURN_TLS_PORT || "5349");
  const staticSecret = process.env.TURN_SERVER_KEY;
  if (!staticSecret) {
    return new Response(
      JSON.stringify({ error: "TURN_SERVER_KEY is not configured on the server" }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }

  const username = String(Math.floor(Date.now() / 1000) + ttlSec);
  const credential = await hmacSha1Base64(staticSecret, username);

  const iceServers = [
    { urls: ["stun:stun.l.google.com:19302"] },
    { urls: [`turn:${domain}:3478?transport=udp`], username, credential },
    // { urls: [`turn:${domain}:3478?transport=tcp`], username, credential },
    { urls: [`turns:${domain}:${tlsPort}?transport=tcp`], username, credential },
  ];

  return new Response(
    JSON.stringify({ username, credential, ttl: ttlSec, domain, tlsPort, iceServers }),
    { headers: { "content-type": "application/json", "cache-control": "no-store" } }
  );
}

export default withErrorReporting(handler);
