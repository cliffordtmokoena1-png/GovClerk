import { getAuth } from "@clerk/nextjs/server";
import { connect } from "@planetscale/database";
import { NextRequest } from "next/server";
import withErrorReporting from "@/error/withErrorReporting";

export const config = {
  runtime: "edge",
};

type AgendaVersion = {
  id: number;
  version: number;
  content: string | null;
  status: string;
  updatedAt: string;
};

type AgendaDetail = {
  id: number;
  seriesId: string;
  title: string | null;
  sourceKind: string;
  sourceText: string;
  content: string | null;
  status: string;
  version: number;
  versions: AgendaVersion[];
  createdAt: string;
  updatedAt: string;
};

async function handler(req: NextRequest) {
  const { userId } = getAuth(req);
  if (userId == null) {
    return new Response(null, { status: 401 });
  }

  // Extract seriesId from URL path
  const url = new URL(req.url);
  const pathParts = url.pathname.split("/");
  const seriesId = pathParts[pathParts.length - 1];

  if (!seriesId) {
    return new Response(JSON.stringify({ message: "Series ID is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  // Get all versions for this series
  const rows = await conn
    .execute(
      `SELECT id, series_id, user_id, version, status, title, source_kind, source_text, 
              content, created_at, updated_at
       FROM agendas
       WHERE series_id = ? AND user_id = ?
       ORDER BY version ASC`,
      [seriesId, userId]
    )
    .then((res) => res.rows);

  if (rows.length === 0) {
    return new Response(JSON.stringify({ message: "Agenda not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const latestRow: any = rows[rows.length - 1];

  const versions: AgendaVersion[] = rows.map((row: any) => ({
    id: row.id,
    version: row.version,
    content: row.content,
    status: row.status,
    updatedAt: row.updated_at,
  }));

  const detail: AgendaDetail = {
    id: latestRow.id,
    seriesId: latestRow.series_id,
    title: latestRow.title,
    sourceKind: latestRow.source_kind,
    sourceText: latestRow.source_text,
    content: latestRow.content,
    status: latestRow.status,
    version: latestRow.version,
    versions,
    createdAt: latestRow.created_at,
    updatedAt: latestRow.updated_at,
  };

  return new Response(JSON.stringify(detail), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

export default withErrorReporting(handler);
