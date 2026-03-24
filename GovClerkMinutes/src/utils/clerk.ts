import { assertString } from "./assert";
import { isDev, isPreview } from "./dev";
import type { Site } from "./site";

export type ClerkKeys = {
  publishableKey: string;
  secretKey: string;
  webhookKey: string;
};

// --- 1. GovClerk Minutes Keys (GCM) ---
const GCM_DEV_KEYS: ClerkKeys = {
  publishableKey: process.env.NEXT_PUBLIC_CLERK_TEST_PUBLISHABLE_KEY!,
  secretKey: process.env.CLERK_TEST_SECRET_KEY!,
  webhookKey: process.env.CLERK_TEST_WH_SECRET!,
};

const GCM_PROD_KEYS: ClerkKeys = {
  publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY!,
  secretKey: process.env.CLERK_SECRET_KEY!,
  webhookKey: process.env.CLERK_WH_SECRET!,
};

// --- 2. GovClerk Keys (GC) ---
const GC_DEV_KEYS: ClerkKeys = {
  publishableKey: process.env.NEXT_PUBLIC_GovClerk_TEST_PUBLISHABLE_KEY!,
  secretKey: process.env.GovClerk_TEST_SECRET_KEY!,
  webhookKey: process.env.GovClerk_TEST_WH_SECRET!,
};

const GC_PROD_KEYS: ClerkKeys = {
  publishableKey: process.env.NEXT_PUBLIC_GovClerk_PUBLISHABLE_KEY!,
  secretKey: process.env.GovClerk_SECRET_KEY!,
  webhookKey: process.env.GovClerk_WH_SECRET!,
};

function isDevOrPreview(): boolean {
  return isDev() || isPreview();
}

function validateClerkKeys(keys: ClerkKeys, site: Site): void {
  const isServer = typeof window === "undefined";
  const missing = !keys.publishableKey || (isServer && !keys.secretKey);
  if (!missing) return;

  console.error(`[clerk] Missing Clerk keys for site "${site}". Check your Vercel Environment Variables.`);
}

// --- The "Key Switcher" Logic ---
export function getClerkKeys(site?: Site): ClerkKeys {
  const s = site ?? "GovClerkMinutes";
  
  if (s === "GovClerk") {
    const keys = isDevOrPreview() ? GC_DEV_KEYS : GC_PROD_KEYS;
    validateClerkKeys(keys, s);
    return keys;
  }

  // FIXED: Pointing back to GCM keys for GovClerkMinutes
  const keys = isDevOrPreview() ? GCM_DEV_KEYS : GCM_PROD_KEYS;
  validateClerkKeys(keys, s);
  return keys;
}

export type WebhookKeyEntry = {
  key: string;
  site: Site;
};

export function getAllWebhookKeys(): WebhookKeyEntry[] {
  return [
    { key: GCM_PROD_KEYS.webhookKey, site: "GovClerkMinutes" as Site },
    { key: GCM_DEV_KEYS.webhookKey, site: "GovClerkMinutes" as Site }, // FIXED
    { key: GC_PROD_KEYS.webhookKey, site: "GovClerk" as Site },
    { key: GC_DEV_KEYS.webhookKey, site: "GovClerk" as Site },
  ].filter((entry) => entry.key);
}

export type ClerkEnvironment = "dev" | "prod";

export function getClerkKeysFromEnv(env?: ClerkEnvironment, site?: Site): ClerkKeys {
  const s = site ?? "GovClerkMinutes";
  const isProd = env === "prod";

  if (s === "GovClerk") {
    return isProd ? GC_PROD_KEYS : GC_DEV_KEYS;
  }
  return isProd ? GCM_PROD_KEYS : GCM_DEV_KEYS; // FIXED
}

export async function createSignInToken(userId: string, site?: Site): Promise<string | null> {
  const { secretKey } = getClerkKeys(site);

  const response = await fetch("https://api.clerk.com/v1/sign_in_tokens", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_id: userId,
      expires_in_seconds: 60 * 20,
    }),
  });

  if (!response.ok) {
    console.error("Failed to create sign-in token:", response.status);
    return null;
  }

  const data = await response.json();
  return assertString(data.token);
}