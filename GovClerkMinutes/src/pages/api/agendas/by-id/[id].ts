import { getAuth } from "@clerk/nextjs/server";
import { connect } from "@planetscale/database";
import { NextRequest } from "next/server";
import withErrorReporting from "@/error/withErrorReporting";

export const config = {
  runtime: "edge",
};

async function handler(req: NextRequest) {
  const { userId } = getAuth(req);
  if (userId == null) {
    return new Response(null, { status: 401 });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ message: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/");
  const agendaId = Number.parseInt(pathParts[pathParts.length - 1]);

  if (!agendaId || Number.isNaN(agendaId)) {
    return new Response(JSON.stringify({ message: "Invalid agenda ID" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  const [agenda] = await conn
    .execute(
      `SELECT id, series_id, user_id, version, status, title, source_kind, source_text, 
              content, created_at, updated_at
       FROM agendas
       WHERE id = ? AND user_id = ?`,
      [agendaId, userId]
    )
    .then((res) => res.rows);

  if (!agenda) {
    return new Response(JSON.stringify({ message: "Agenda not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const row = agenda as any;

  return new Response(
    JSON.stringify({
      id: row.id,
      seriesId: row.series_id,
      userId: row.user_id,
      version: row.version,
      status: row.status,
      title: row.title,
      sourceKind: row.source_kind,
      sourceText: row.source_text,
      content: row.content,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}

export default withErrorReporting(handler);
