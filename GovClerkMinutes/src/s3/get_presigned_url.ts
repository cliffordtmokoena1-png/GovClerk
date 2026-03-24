// Edge-compatible S3 pre-signed URL generator (SigV4) using Web Crypto.
// Can be used from Vercel Edge functions — avoids any Node-only APIs.

import { BucketName, Region } from "@/utils/s3";

export type HttpMethod = "GET" | "PUT" | "DELETE";

export type GetPresignedUrlParams = {
  // Object key in the bucket (e.g., "uploads/voice.ogg").
  key: string;
  // Expiration in seconds (max 7 days for SigV4 presign).
  expiresInSecs: number;
  // HTTP method for the operation (default: PUT for uploads).
  method: HttpMethod;
  bucket: BucketName;
  region: Region;
  accessKeyId: string;
  secretAccessKey: string;
};

type PresignedUrlResult = {
  presignedUrl: string;
  method: HttpMethod;
  expiresInSeconds: number;
  host: string;
  key: string;
};

async function hmac(key: ArrayBuffer | string, data: string) {
  const enc = new TextEncoder();
  const keyObj = await crypto.subtle.importKey(
    "raw",
    typeof key === "string" ? enc.encode(key) : key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return crypto.subtle.sign("HMAC", keyObj, enc.encode(data));
}

async function sha256Hex(data: string) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data));
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// RFC 3986 encode (encodeURIComponent but with uppercase hex and no special-case loosening)
function rfc3986Encode(str: string): string {
  return encodeURIComponent(str).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

/**
 * Generate an AWS S3 pre-signed URL for GET/PUT/DELETE using Signature V4.
 * Note: For uploads, the resulting URL is typically used with PUT and no extra signed headers.
 */
export default async function get_presigned_url({
  key,
  expiresInSecs,
  method,
  bucket,
  region,
  accessKeyId,
  secretAccessKey,
}: GetPresignedUrlParams): Promise<PresignedUrlResult> {
  const expires = Math.max(1, Math.floor(expiresInSecs));

  const host = `${bucket}.s3.${region}.amazonaws.com`;

  const now = new Date();
  // ISO8601 basic format: YYYYMMDD'T'HHMMSS'Z'
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.substring(0, 8); // YYYYMMDD

  const service = "s3";
  const algorithm = "AWS4-HMAC-SHA256";
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;

  // Canonical request pieces
  // Encode each path segment; preserve '/'
  const encodedKey = key
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  const canonicalUri = `/${encodedKey}`;

  // Build canonical query string (sorted, RFC3986-encoded)
  const queryEntries: Array<[string, string]> = [
    ["X-Amz-Algorithm", algorithm],
    ["X-Amz-Credential", `${accessKeyId}/${credentialScope}`],
    ["X-Amz-Date", amzDate],
    ["X-Amz-Expires", String(expires)],
    ["X-Amz-SignedHeaders", "host"],
  ];
  queryEntries.sort((a, b) =>
    a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0])
  );
  const canonicalQuery = queryEntries
    .map(([k, v]) => `${rfc3986Encode(k)}=${rfc3986Encode(v)}`)
    .join("&");

  // Only sign the host header to keep the client requirements minimal
  const canonicalHeaders = `host:${host}\n`;
  const signedHeaders = "host";

  // For S3 presigned URLs, the payload hash MUST be the literal string "UNSIGNED-PAYLOAD"
  // Ref: AWS Signature Version 4 for query-authenticated requests
  const payloadHash = "UNSIGNED-PAYLOAD";

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join("\n");

  // Derive signing key (AWS Signature V4)
  const kDate = await hmac("AWS4" + secretAccessKey, dateStamp);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, service);
  const kSigning = await hmac(kService, "aws4_request");

  const signatureBuf = await hmac(kSigning, stringToSign);
  const signature = toHex(signatureBuf);

  const presignedUrl = `https://${host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;

  return {
    presignedUrl,
    method,
    expiresInSeconds: expires,
    host,
    key,
  };
}
