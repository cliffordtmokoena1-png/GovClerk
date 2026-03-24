import { getAuth } from "@clerk/nextjs/server";
import { connect } from "@planetscale/database";
import { NextRequest } from "next/server";
import withErrorReporting from "@/error/withErrorReporting";
import { serverUri } from "@/utils/server";

export const config = {
  runtime: "edge",
};

type AgendaRow = {
  user_id: string;
  source_text: string;
  series_id: string;
  title: string | null;
};

async function handler(req: NextRequest) {
  const { userId } = getAuth(req);
  if (userId == null) {
    return new Response(null, { status: 401 });
  }

  if (req.method !== "POST") {
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

  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  const [agenda] = await conn
    .execute("SELECT user_id, source_text, series_id, title FROM agendas WHERE id = ?", [agendaId])
    .then((res) => res.rows);

  if (!agenda || (agenda as AgendaRow).user_id !== userId) {
    return new Response(JSON.stringify({ message: "Agenda not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const sourceText = (agenda as AgendaRow).source_text;
  const seriesId = (agenda as AgendaRow).series_id;
  const title = (agenda as AgendaRow).title;

  const authHeader = req.headers.get("authorization");

  if (!authHeader) {
    return new Response(JSON.stringify({ message: "Missing authorization header" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const response = await fetch(serverUri("/api/create-agenda"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify({
      agenda_id: agendaId,
      source_text: sourceText,
      title: title,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return new Response(JSON.stringify({ message: `Server error: ${errorText}` }), {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  let result: { status?: string; content?: string } = {};
  try {
    result = await response.json();
  } catch {
    return new Response(JSON.stringify({ message: "Invalid response from generation server" }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({
      id: agendaId,
      seriesId,
      status: result.status ?? "pending",
      content: result.content ?? null,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}

export default withErrorReporting(handler);
