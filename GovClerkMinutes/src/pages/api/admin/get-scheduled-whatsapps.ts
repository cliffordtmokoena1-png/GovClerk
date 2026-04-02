import { getAuth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import withErrorReporting from "@/error/withErrorReporting";
import { connect } from "@planetscale/database";
import { isMissingTableError } from "@/admin/whatsapp/query";

export const config = {
  runtime: "edge",
};

async function handler(req: NextRequest) {
  const { userId: adminUserId, sessionClaims } = getAuth(req);
  if (!adminUserId || !sessionClaims?.metadata?.role || sessionClaims.metadata.role !== "admin") {
    return new Response(null, { status: 401 });
  }

  try {
    const conn = connect({
      host: process.env.PLANETSCALE_DB_HOST,
      username: process.env.PLANETSCALE_DB_USERNAME,
      password: process.env.PLANETSCALE_DB_PASSWORD,
    });

    const rows = await conn
      .execute(
        `
      SELECT whatsapp_id, template_id, send_at, sender_user_id, is_sent
      FROM gc_scheduled_whatsapps
      ORDER BY send_at DESC
      LIMIT 100
      `,
        []
      )
      .then((result) => result.rows);

    return new Response(JSON.stringify(rows), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("[admin/get-scheduled-whatsapps] Handler error:", error);
    // If the table doesn't exist yet (errno 1146), return an empty array instead of 500
    if (isMissingTableError(error)) {
      console.warn(
        "[admin/get-scheduled-whatsapps] gc_scheduled_whatsapps table not yet created — returning empty result"
      );
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export default withErrorReporting(handler);
