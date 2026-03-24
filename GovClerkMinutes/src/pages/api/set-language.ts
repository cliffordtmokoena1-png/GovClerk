import withErrorReporting from "@/error/withErrorReporting";
import { assertNumber, assertString } from "@/utils/assert";
import { connect } from "@planetscale/database";
import { NextRequest } from "next/server";
import { getAuth } from "@clerk/nextjs/server";
import { prodServerUri, serverUri } from "@/utils/server";
import { forceProdServerInDev, isDev } from "@/utils/dev";
import { getUploadKey } from "@/utils/s3";

export const config = {
  runtime: "edge",
};

async function handler(req: NextRequest) {
  const { userId } = getAuth(req);
  if (userId == null) {
    return new Response(null, { status: 401 });
  }

  const body = await req.json();
  const language = assertString(body.language);
  const transcriptId = assertNumber(body.transcriptId);

  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  await conn.execute(
    `
      UPDATE transcripts
      SET language = ?,
          preview_transcribe_finished = 1
      WHERE id = ?
      AND userId = ?
    `,
    [language, transcriptId, userId]
  );

  const res = await fetch(
    serverUri(`/api/get-diarization?afterlanguage=1${isDev() ? "&test=1" : ""}`),
    {
      method: "POST",
      body: JSON.stringify({ s3_audio_key: getUploadKey(transcriptId) }),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${assertString(process.env.UPLOAD_COMPLETE_WEBHOOK_SECRET)}`,
      },
    }
  );

  if (!res.ok) {
    await conn.execute(
      `
        UPDATE transcripts
        SET transcribe_failed = 33
        WHERE id = ?
        AND userId = ?
      `,
      [transcriptId, userId]
    );
    const text = await res.text().catch(() => "");
    return new Response(text || `Request failed with ${res.status}`, { status: res.status });
  }

  return new Response(JSON.stringify({}), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

export default withErrorReporting(handler);
