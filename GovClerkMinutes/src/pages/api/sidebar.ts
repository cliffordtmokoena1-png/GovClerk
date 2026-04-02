import withErrorReporting from "@/error/withErrorReporting";
import { getAuth } from "@clerk/nextjs/server";
import { connect } from "@planetscale/database";
import { NextRequest } from "next/server";
import { resolveRequestContext } from "@/utils/resolveRequestContext";

export type ApiSidebarResponse = {
  sidebarItems: Array<{
    transcriptId: number;
    title: string;
    dateCreated: string;
    type: "minutes" | "agenda";
    seriesId?: string;
  }>;
};

export const config = {
  runtime: "edge",
};

export async function getSidebarItems(
  userId: string,
  orgId: string | null = null
): Promise<ApiSidebarResponse> {
  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  let transcriptsQuery: string;
  let transcriptsParams: string[];

  if (orgId) {
    transcriptsQuery =
      "SELECT id, title, dateCreated FROM transcripts WHERE org_id = ? AND client_corruption = 0 AND deleted = 0";
    transcriptsParams = [orgId];
  } else {
    transcriptsQuery =
      "SELECT id, title, dateCreated FROM transcripts WHERE userId = ? AND org_id IS NULL AND client_corruption = 0 AND deleted = 0";
    transcriptsParams = [userId];
  }

  const transcriptsPromise = conn
    .execute(transcriptsQuery, transcriptsParams)
    .then((result) => result.rows);

  let agendasQuery: string;
  let agendasParams: string[];

  if (orgId) {
    agendasQuery = `SELECT a.id, a.series_id, a.title, a.updated_at 
       FROM agendas a
       INNER JOIN (
         SELECT series_id, MAX(version) as max_version
         FROM agendas
         WHERE org_id = ?
         GROUP BY series_id
       ) latest ON a.series_id = latest.series_id AND a.version = latest.max_version
       WHERE a.org_id = ?
       ORDER BY a.updated_at DESC`;
    agendasParams = [orgId, orgId];
  } else {
    agendasQuery = `SELECT a.id, a.series_id, a.title, a.updated_at 
       FROM agendas a
       INNER JOIN (
         SELECT series_id, MAX(version) as max_version
         FROM agendas
         WHERE user_id = ? AND org_id IS NULL
         GROUP BY series_id
       ) latest ON a.series_id = latest.series_id AND a.version = latest.max_version
       WHERE a.user_id = ? AND a.org_id IS NULL
       ORDER BY a.updated_at DESC`;
    agendasParams = [userId, userId];
  }

  // Run both queries concurrently; if the agendas query fails (e.g. the table
  // does not yet exist), fall back to an empty list so the page still loads.
  const agendasPromise = conn
    .execute(agendasQuery, agendasParams)
    .then(
      (result) =>
        result.rows as Array<{
          id: unknown;
          series_id: unknown;
          title: unknown;
          updated_at: unknown;
        }>
    )
    .catch((error) => {
      console.error("[sidebar] Failed to fetch agendas:", error);
      return [] as Array<{ id: unknown; series_id: unknown; title: unknown; updated_at: unknown }>;
    });

  const [transcriptRows, agendaRows] = await Promise.all([transcriptsPromise, agendasPromise]);

  const transcripts = transcriptRows.map((row: any) => ({
    transcriptId: parseInt(row["id"]),
    title: row["title"],
    dateCreated: row["dateCreated"],
    type: "minutes" as const,
  }));

  const agendas = agendaRows.map((row: any) => ({
    transcriptId: parseInt(row["id"]),
    title: row["title"] || "Untitled Agenda",
    dateCreated: row["updated_at"],
    type: "agenda" as const,
    seriesId: row["series_id"],
  }));

  return {
    sidebarItems: [...transcripts, ...agendas].sort(
      (a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime()
    ),
  };
}

async function handler(req: NextRequest) {
  const auth = getAuth(req);
  if (auth.userId == null) {
    return new Response(null, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { userId, orgId } = await resolveRequestContext(auth.userId, body.orgId, req.headers);

  const response = await getSidebarItems(userId, orgId);

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

export default withErrorReporting(handler);
