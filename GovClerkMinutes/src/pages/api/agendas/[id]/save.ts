import { getAuth } from "@clerk/nextjs/server";
import { connect } from "@planetscale/database";
import { NextRequest } from "next/server";
import withErrorReporting from "@/error/withErrorReporting";
import { canAccessResourceWithOrgId } from "@/utils/resourceAccess";
import { getSiteFromHeaders } from "@/utils/site";

export const config = {
  runtime: "edge",
};

type SaveAgendaRequest = {
  content: string;
};

async function handler(req: NextRequest) {
  const { userId } = getAuth(req);
  if (userId == null) {
    return new Response(null, { status: 401 });
  }

  if (req.method !== "POST" && req.method !== "PATCH") {
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

  let body: SaveAgendaRequest;
  try {
    body = await req.json();
  } catch (error) {
    return new Response(JSON.stringify({ message: "Invalid JSON in request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { content } = body;

  if (content === undefined || content === null) {
    return new Response(JSON.stringify({ message: "Content is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  // Verify ownership or organization access
  const site = getSiteFromHeaders(req.headers);
  const accessResult = await canAccessResourceWithOrgId("agendas", agendaId, userId, site);

  if (!accessResult.hasAccess) {
    return new Response(JSON.stringify({ message: "Agenda not found or access denied" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Update content
  await conn.execute("UPDATE agendas SET content = ?, updated_at = NOW() WHERE id = ?", [
    content,
    agendaId,
  ]);

  return new Response(JSON.stringify({ message: "Agenda saved successfully" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

export default withErrorReporting(handler);
