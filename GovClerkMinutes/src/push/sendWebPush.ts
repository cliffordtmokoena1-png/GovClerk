import { connect } from "@planetscale/database";
import { VAPID_PUBLIC_KEY_B64URL, VAPID_SUBJECT } from "./consts";
import webpush from "web-push";

type Subscription = {
  endpoint: string;
  keys?: { p256dh?: string; auth?: string };
};

export type PushContent = {
  title?: string;
  body?: string;
  tag?: string;
  url?: string;
};
let webPushConfigured = false;
function ensureWebPushConfigured(): void {
  if (webPushConfigured) {
    return;
  }
  const publicKey = VAPID_PUBLIC_KEY_B64URL;
  const privateKey = process.env.VAPID_PRIVATE_KEY_B64URL;
  if (!publicKey || !privateKey) {
    throw new Error(
      "Missing VAPID keys. Ensure VAPID_PUBLIC_KEY_B64URL and VAPID_PRIVATE_KEY_B64URL are set."
    );
  }

  webpush.setVapidDetails(VAPID_SUBJECT, publicKey, privateKey);
  webPushConfigured = true;
}

export async function sendWebPush(
  sub: Subscription,
  ttlSeconds = 60,
  content?: PushContent
): Promise<{ ok: boolean; status: number; statusText: string; body?: string }> {
  ensureWebPushConfigured();

  // web-push accepts the subscription object as-is
  const subscription: webpush.PushSubscription = {
    endpoint: sub.endpoint,
    keys: sub.keys as any,
  };

  const hasKeys = !!(sub.keys?.p256dh && sub.keys?.auth);
  const payload = hasKeys && content ? JSON.stringify(content) : undefined;

  try {
    const res = await webpush.sendNotification(subscription, payload, { TTL: ttlSeconds });
    const status = (res as any).statusCode ?? 201;
    return { ok: status >= 200 && status < 300, status, statusText: "", body: (res as any).body };
  } catch (err: any) {
    const status = err?.statusCode ?? 0;
    const body = err?.body ?? String(err);
    return { ok: false, status, statusText: err?.message ?? "", body };
  }
}

async function getAdminPushSubscriptions(): Promise<Subscription[]> {
  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  const subs = await conn.execute("SELECT endpoint, p256dh, auth FROM gc_push_subscriptions");
  const rows = subs.rows as Array<{
    endpoint: string;
    p256dh?: string | null;
    auth?: string | null;
  }>;
  return rows.map((r) => ({
    endpoint: r.endpoint,
    keys: { p256dh: r.p256dh ?? undefined, auth: r.auth ?? undefined },
  }));
}

async function deleteSubscriptionByEndpoint(endpoint: string): Promise<void> {
  try {
    const conn = connect({
      host: process.env.PLANETSCALE_DB_HOST,
      username: process.env.PLANETSCALE_DB_USERNAME,
      password: process.env.PLANETSCALE_DB_PASSWORD,
    });
    await conn.execute(
      `
      DELETE FROM gc_push_subscriptions
      WHERE endpoint = ?
      `,
      [endpoint]
    );
  } catch (e) {
    console.warn("Failed to delete invalid push subscription", { endpoint, error: e });
  }
}

// High-level: send a push to all admin subscriptions. Content is reserved for future payload use.
export async function sendPushToAdmins(content: PushContent = {}): Promise<void> {
  const subs = await getAdminPushSubscriptions();
  const results = await Promise.allSettled(
    subs.map(async (s) => {
      const res = await sendWebPush(s, 60, content).catch((err) => {
        console.error("Error sending WebPush", err);
        throw err;
      });

      if (!res.ok) {
        const info = {
          endpointHost: new URL(s.endpoint).host,
          status: res.status,
          statusText: res.statusText,
          body: res.body,
        } as const;
        console.error("WebPush non-OK", info);

        // Clean up invalid subscriptions (common on VAPID key rotation or expired FCM registrations)
        if (
          res.status === 404 ||
          res.status === 410 ||
          // 403 with credential mismatch text
          (res.status === 403 &&
            (res.body?.toLowerCase().includes("vapid") ||
              res.body?.toLowerCase().includes("credential")))
        ) {
          await deleteSubscriptionByEndpoint(s.endpoint);
        }
      }
      return res.ok;
    })
  );
  const okCount = results.filter((r) => r.status === "fulfilled" && r.value === true).length;
  const failCount = subs.length - okCount;
  if (failCount > 0) {
    console.warn(`WebPush completed with ${okCount} success, ${failCount} failures`);
  }
}
