import { getAuth } from "@clerk/nextjs/server";
import { connect } from "@planetscale/database";
import { NextRequest } from "next/server";
import withErrorReporting from "@/error/withErrorReporting";
import { convertIsoTimestampFromMysql } from "@/utils/date";

export const config = {
  runtime: "edge",
};

export type QuickReply = {
  id: string; // bigint stored as string for consistency
  name: string;
  body: string; // maps to `message` column
  createdAt?: string; // derived from created_at
};

async function listQuickRepliesDb(
  conn: ReturnType<typeof connect>,
  userId: string
): Promise<QuickReply[]> {
  const rows = await conn
    .execute<{
      id: string | number;
      name: string;
      message: string;
      created_at: string;
    }>(
      "SELECT id, name, message, created_at FROM gc_whatsapp_quick_replies WHERE user_id = ? ORDER BY id DESC",
      [userId]
    )
    .then((r) => r.rows);
  return rows.map((r) => ({
    id: String(r.id),
    name: r.name,
    body: r.message,
    createdAt: convertIsoTimestampFromMysql(r.created_at),
  }));
}

async function handler(req: NextRequest) {
  const { userId, sessionClaims } = getAuth(req);
  if (!userId || !sessionClaims?.metadata?.role || sessionClaims.metadata.role !== "admin") {
    return new Response(null, { status: 401 });
  }

  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  const url = new URL(req.url);
  const id = url.searchParams.get("id") || undefined;

  try {
    if (req.method === "GET") {
      const items = await listQuickRepliesDb(conn, userId);
      return new Response(JSON.stringify({ items }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (req.method === "POST") {
      const body = (await req.json()) as { name?: string; body?: string };
      const name = (body.name || "").trim();
      const textBody = (body.body || "").trim();
      if (!name || !textBody) {
        return new Response("Missing name or body", { status: 400 });
      }
      const result = await conn.execute(
        "INSERT INTO gc_whatsapp_quick_replies (user_id, name, message) VALUES (?, ?, ?)",
        [userId, name, textBody]
      );
      const newItem: QuickReply = {
        id: String(result.insertId),
        name,
        body: textBody,
      };
      return new Response(JSON.stringify(newItem), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (req.method === "PUT") {
      if (!id) {
        return new Response("Missing id", { status: 400 });
      }
      const body = (await req.json()) as { name?: string; body?: string };
      const sets: string[] = [];
      const values: any[] = [];
      if (body.name !== undefined) {
        sets.push("name = ?");
        values.push(String(body.name));
      }
      if (body.body !== undefined) {
        sets.push("message = ?");
        values.push(String(body.body));
      }
      if (sets.length === 0) {
        return new Response("No changes", { status: 400 });
      }
      values.push(userId, Number(id));
      const sql = `UPDATE gc_whatsapp_quick_replies SET ${sets.join(", ")} WHERE user_id = ? AND id = ?`;
      const result = await conn.execute(sql, values);
      if ((result.rowsAffected ?? 0) === 0) {
        return new Response("Not found", { status: 404 });
      }
      // Return the updated snapshot
      const items = await listQuickRepliesDb(conn, userId);
      const updated = items.find((it) => it.id === String(id));
      return new Response(JSON.stringify(updated ?? null), {
        status: updated ? 200 : 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (req.method === "DELETE") {
      if (!id) {
        return new Response("Missing id", { status: 400 });
      }
      const result = await conn.execute(
        "DELETE FROM gc_whatsapp_quick_replies WHERE user_id = ? AND id = ?",
        [userId, Number(id)]
      );
      if ((result.rowsAffected ?? 0) === 0) {
        return new Response("Not found", { status: 404 });
      }
      return new Response(null, { status: 204 });
    }

    return new Response("Method not allowed", { status: 405 });
  } catch (error) {
    console.error("[admin/whatsapp/quick-reply] Handler error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export default withErrorReporting(handler);
