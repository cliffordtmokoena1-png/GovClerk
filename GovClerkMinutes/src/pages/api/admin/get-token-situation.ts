import { NextRequest } from "next/server";
import withErrorReporting from "@/error/withErrorReporting";
import { withServiceAccountOrAdminAuth } from "@/utils/serviceAccountAuth";
import { assertString } from "@/utils/assert";
import { connect } from "@planetscale/database";
import { convertIsoTimestampFromMysql } from "@/utils/date";

export const config = {
  runtime: "edge",
};

export type TokenSituation = {
  transcriptId: number;
  createdAt: string;
  transcribePaused: boolean;
  transcribeFinished: boolean;
  tokensRequired: number;
};

type Row = {
  id: number;
  dateCreated: string;
  transcribe_paused: number;
  transcribe_finished: number;
  credits_required: number;
};

async function handler(req: NextRequest) {
  const persona = req.headers.get("x-service-account-persona");
  if (persona) {
    console.log(`[admin/get-token-situation] Called by service account: ${persona}`);
  }

  try {
    const body = await req.json();
    const userId = assertString(body.userId);

    const conn = connect({
      host: process.env.PLANETSCALE_DB_HOST,
      username: process.env.PLANETSCALE_DB_USERNAME,
      password: process.env.PLANETSCALE_DB_PASSWORD,
    });

    const rows: TokenSituation[] = await conn
      .execute<Row>(
        `
        SELECT
          id,
          dateCreated,
          transcribe_paused,
          transcribe_finished,
          credits_required
        FROM transcripts
        WHERE userId = ?
        ORDER BY dateCreated DESC
      `,
        [userId]
      )
      .then((res) =>
        res.rows.map((row) => ({
          transcriptId: row.id,
          createdAt: convertIsoTimestampFromMysql(row.dateCreated),
          transcribePaused: Boolean(row.transcribe_paused),
          transcribeFinished: Boolean(row.transcribe_finished),
          tokensRequired: Number(row.credits_required),
        }))
      );

    // The least recent upload is always the example upload
    rows.pop();

    return new Response(JSON.stringify({ rows }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[admin/get-token-situation] Handler error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export default withErrorReporting(withServiceAccountOrAdminAuth(handler));
