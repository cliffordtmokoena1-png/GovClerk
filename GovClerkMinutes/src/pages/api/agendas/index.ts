import { getAuth } from "@clerk/nextjs/server";
import { connect } from "@planetscale/database";
import { NextRequest } from "next/server";
import withErrorReporting from "@/error/withErrorReporting";

export const config = {
  runtime: "edge",
};

const MAX_SOURCE_TEXT_LENGTH = 20000;

type PostBody = {
  sourceText?: string;
  title?: string;
};

type AgendaRow = {
  id: number;
  series_id: string;
  title: string | null;
  status: string;
  updated_at: string;
  created_at: string;
};

function generateSeriesId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 15);
  return `${timestamp}${randomPart}`.toUpperCase().substring(0, 26);
}

function getDbConnection() {
  return connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });
}

async function handlePost(req: NextRequest, userId: string, orgId: string | null) {
  let body: PostBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ message: "Invalid JSON in request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const sourceText = typeof body.sourceText === "string" ? body.sourceText.trim() : "";
  const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : null;

  if (!sourceText) {
    return new Response(JSON.stringify({ message: "Source text is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (sourceText.length > MAX_SOURCE_TEXT_LENGTH) {
    return new Response(
      JSON.stringify({
        message: `Source text exceeds maximum length of ${MAX_SOURCE_TEXT_LENGTH} characters`,
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const seriesId = generateSeriesId();
  const conn = getDbConnection();

  let insertId: string | number;
  try {
    // Try the full INSERT with all columns first.
    const result = await conn.execute(
      `INSERT INTO agendas
         (series_id, user_id, org_id, version, status, title, source_kind, source_text, created_at, updated_at)
       VALUES
         (?, ?, ?, 1, 'pending', ?, 'text', ?, NOW(), NOW())`,
      [seriesId, userId, orgId, title, sourceText]
    );
    insertId = result.insertId;
  } catch (err: unknown) {
    // If the insert failed because source_kind column is missing (MySQL errno 1054),
    // retry without that optional column so existing DB schemas without the column
    // still work.
    const isMissingColumn =
      err instanceof Error &&
      (err.message.includes("source_kind") ||
        ("errno" in err && (err as { errno: number }).errno === 1054) ||
        ("number" in err && (err as { number: number }).number === 1054) ||
        err.message.includes("1054"));

    if (isMissingColumn) {
      try {
        const result = await conn.execute(
          `INSERT INTO agendas
             (series_id, user_id, org_id, version, status, title, source_text, created_at, updated_at)
           VALUES
             (?, ?, ?, 1, 'pending', ?, ?, NOW(), NOW())`,
          [seriesId, userId, orgId, title, sourceText]
        );
        insertId = result.insertId;
      } catch (fallbackErr) {
        console.error("[agendas] INSERT (fallback) failed:", fallbackErr);
        return new Response(JSON.stringify({ message: "Failed to create agenda" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    } else {
      console.error("[agendas] INSERT failed:", err);
      return new Response(JSON.stringify({ message: "Failed to create agenda" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  return new Response(JSON.stringify({ id: insertId, seriesId, status: "pending" }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
}

async function handleGet(req: NextRequest, userId: string, orgId: string | null) {
  const url = new URL(req.url);
  // Clamp limit to [1, 100] and offset to >= 0 to prevent bad DB queries.
  const limit = Math.min(Math.max(Number.parseInt(url.searchParams.get("limit") || "20"), 1), 100);
  const offset = Math.max(Number.parseInt(url.searchParams.get("offset") || "0"), 0);

  const conn = getDbConnection();

  let rows: AgendaRow[];
  try {
    if (orgId) {
      const result = await conn.execute(
        `SELECT id, series_id, title, status, updated_at, created_at
         FROM agendas
         WHERE org_id = ? AND version = 1
         ORDER BY updated_at DESC
         LIMIT ? OFFSET ?`,
        [orgId, limit, offset]
      );
      rows = result.rows as AgendaRow[];
    } else {
      const result = await conn.execute(
        `SELECT id, series_id, title, status, updated_at, created_at
         FROM agendas
         WHERE user_id = ? AND org_id IS NULL AND version = 1
         ORDER BY updated_at DESC
         LIMIT ? OFFSET ?`,
        [userId, limit, offset]
      );
      rows = result.rows as AgendaRow[];
    }
  } catch (err) {
    console.error("[agendas] SELECT failed:", err);
    return new Response(JSON.stringify({ agendas: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const agendas = rows.map((row) => ({
    id: row.id,
    seriesId: row.series_id,
    title: row.title ?? null,
    status: row.status,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  }));

  return new Response(JSON.stringify({ agendas }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

async function handler(req: NextRequest) {
  const auth = getAuth(req);
  if (!auth.userId) {
    return new Response(null, { status: 401 });
  }

  // Use the org context already validated by Clerk's JWT — no extra API call needed.
  const userId = auth.userId;
  const orgId = auth.orgId ?? null;

  if (req.method === "POST") {
    return handlePost(req, userId, orgId);
  }

  if (req.method === "GET") {
    return handleGet(req, userId, orgId);
  }

  return new Response(JSON.stringify({ message: "Method not allowed" }), {
    status: 405,
    headers: { "Content-Type": "application/json" },
  });
}

export default withErrorReporting(handler);
