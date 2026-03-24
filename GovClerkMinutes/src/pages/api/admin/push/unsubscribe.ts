import withErrorReporting from "@/error/withErrorReporting";
import { assertString } from "@/utils/assert";
import { getAuth } from "@clerk/nextjs/server";
import { connect } from "@planetscale/database";

export const config = {
  runtime: "edge",
};

type UnsubscribeBody = {
  deviceId: string;
};

async function handler(req: Request): Promise<Response> {
  const { userId, sessionClaims } = getAuth(req as any);
  if (!userId || !sessionClaims?.metadata?.role || sessionClaims.metadata.role !== "admin") {
    return new Response(null, { status: 401 });
  }

  try {
    let payload: UnsubscribeBody = await req.json();
    const deviceId = assertString(payload.deviceId);

    const conn = connect({
      host: process.env.PLANETSCALE_DB_HOST,
      username: process.env.PLANETSCALE_DB_USERNAME,
      password: process.env.PLANETSCALE_DB_PASSWORD,
    });

    await conn.execute("DELETE FROM gc_push_subscriptions WHERE user_id = ? AND device_id = ?", [
      userId,
      deviceId,
    ]);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[admin/push/unsubscribe] Handler error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export default withErrorReporting(handler);
