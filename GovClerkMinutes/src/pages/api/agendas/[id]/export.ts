import { getAuth } from "@clerk/nextjs/server";
import { connect } from "@planetscale/database";
import { NextRequest } from "next/server";
import withErrorReporting from "@/error/withErrorReporting";

export const config = {
  runtime: "edge",
};

type ExportAgendaRequest = {
  format: "copy" | "docx" | "pdf";
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

  // Extract ID from URL path
  const url = new URL(req.url);
  const pathParts = url.pathname.split("/");
  const agendaId = Number.parseInt(pathParts[pathParts.length - 2]);

  if (!agendaId || Number.isNaN(agendaId)) {
    return new Response(JSON.stringify({ message: "Invalid agenda ID" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: ExportAgendaRequest;
  try {
    body = await req.json();
  } catch (error) {
    return new Response(JSON.stringify({ message: "Invalid JSON in request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { format } = body;

  if (!format || !["copy", "docx", "pdf"].includes(format)) {
    return new Response(JSON.stringify({ message: "Invalid export format" }), {
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

  // Track export event
  let updateQuery: string;
  if (format === "copy") {
    updateQuery =
      "UPDATE agendas SET copy_clicks = copy_clicks + 1, updated_at = NOW() WHERE id = ?";
  } else if (format === "docx") {
    updateQuery =
      "UPDATE agendas SET docx_clicks = docx_clicks + 1, updated_at = NOW() WHERE id = ?";
  } else {
    updateQuery = "UPDATE agendas SET pdf_clicks = pdf_clicks + 1, updated_at = NOW() WHERE id = ?";
  }

  await conn.execute(updateQuery, [agendaId]);

  return new Response(JSON.stringify({ message: "Export tracked successfully" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

export default withErrorReporting(handler);
