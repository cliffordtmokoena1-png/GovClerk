import withErrorReporting from "@/error/withErrorReporting";
import { getAuth } from "@clerk/nextjs/server";
import { connect } from "@planetscale/database";

export const config = {
  runtime: "edge",
};

type PushSubscriptionJSON = {
  endpoint: string;
  expirationTime: number | null;
  keys?: { p256dh?: string; auth?: string };
};

async function handler(req: Request): Promise<Response> {
  const { userId, sessionClaims } = getAuth(req as any);
  if (!userId || !sessionClaims?.metadata?.role || sessionClaims.metadata.role !== "admin") {
    return new Response(null, { status: 401 });
  }

  try {
    const body = (await req.json()) as { deviceId: string; sub: PushSubscriptionJSON };
    const { deviceId, sub } = body;
    if (!sub?.endpoint) {
      return new Response(JSON.stringify({ error: "Invalid subscription" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (!deviceId || typeof deviceId !== "string") {
      return new Response(JSON.stringify({ error: "Missing deviceId" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const conn = connect({
      host: process.env.PLANETSCALE_DB_HOST,
      username: process.env.PLANETSCALE_DB_USERNAME,
      password: process.env.PLANETSCALE_DB_PASSWORD,
    });

    const p256dh = sub.keys?.p256dh ?? null;
    const auth = sub.keys?.auth ?? null;
    const expirationTime = sub.expirationTime ?? null;

    await conn.execute(
      `
      INSERT INTO gc_push_subscriptions (user_id, device_id, endpoint, p256dh, auth, expiration_time)
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        endpoint = VALUES(endpoint),
        p256dh = VALUES(p256dh),
        auth = VALUES(auth),
        expiration_time = VALUES(expiration_time)
      `,
      [userId, deviceId, sub.endpoint, p256dh, auth, expirationTime]
    );

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[admin/push/subscribe] Handler error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export default withErrorReporting(handler);
