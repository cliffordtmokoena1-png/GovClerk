import { getAuth } from "@clerk/nextjs/server";
import { connect } from "@planetscale/database";
import { NextRequest } from "next/server";
import withErrorReporting from "@/error/withErrorReporting";
import { capture } from "@/utils/posthog";

export const config = {
  runtime: "edge",
};

async function handler(req: NextRequest) {
  const { userId } = getAuth(req);
  if (userId == null) {
    return new Response(null, { status: 401 });
  }

  if (req.method !== "PATCH") {
    return new Response(JSON.stringify({ message: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/");
  const agendaId = Number.parseInt(pathParts[pathParts.length - 2]);

  if (!agendaId || Number.isNaN(agendaId)) {
    return new Response(JSON.stringify({ message: "Invalid agenda ID" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body;
  try {
    body = await req.json();
  } catch (error) {
    return new Response(JSON.stringify({ message: "Invalid JSON in request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { title } = body;
  const posthog_session_id = req.headers.get("x-posthog-session-id");

  if (!title || typeof title !== "string") {
    return new Response(JSON.stringify({ message: "Title is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  // Verify ownership
  const [agenda] = await conn
    .execute("SELECT user_id FROM agendas WHERE id = ?", [agendaId])
    .then((res) => res.rows);

  if (!agenda || (agenda as any).user_id !== userId) {
    return new Response(JSON.stringify({ message: "Agenda not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Update title
  await conn.execute("UPDATE agendas SET title = ?, updated_at = NOW() WHERE id = ?", [
    title.trim().substring(0, 255),
    agendaId,
  ]);

  await capture(
    "agenda_title_updated",
    {
      agenda_id: agendaId,
      $session_id: posthog_session_id,
    },
    userId
  );

  return new Response(JSON.stringify({ message: "Title updated successfully" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

export default withErrorReporting(handler);
