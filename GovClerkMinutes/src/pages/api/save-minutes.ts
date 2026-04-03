import { getAuth } from "@clerk/nextjs/server";
import { connect } from "@planetscale/database";
import { NextRequest } from "next/server";
import withErrorReporting from "@/error/withErrorReporting";
import { diffChars } from "diff";
import { isUnknownColumnOrMissingTableError } from "@/utils/dbErrors";

export const config = {
  runtime: "edge",
};

async function handler(req: NextRequest) {
  const { userId } = getAuth(req);
  if (userId == null) {
    return new Response(null, { status: 401 });
  }

  let body;
  try {
    body = await req.json();
  } catch (error) {
    return new Response(JSON.stringify({ message: "Invalid JSON in request body" }), {
      status: 400,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  const { transcriptId, content, version, fastMode } = body;

  if (transcriptId == null || content == null || version == null || fastMode == null) {
    return new Response(JSON.stringify({ message: "Missing required fields" }), {
      status: 400,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  const [transcript] = await conn
    .execute("SELECT userId FROM transcripts WHERE id = ?", [transcriptId])
    .then((res) => res.rows);

  if (!transcript || transcript.userId !== userId) {
    return new Response(JSON.stringify({ message: "Forbidden" }), {
      status: 403,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  const [currentMinutes] = await conn
    .execute(
      "SELECT minutes, version, fast_mode, updated_at FROM minutes WHERE transcript_id = ? AND user_id = ? AND version = ? AND fast_mode = ?",
      [transcriptId, userId, version, fastMode]
    )
    .then((res) => res.rows);

  let changes: { base_version: number }[] = [];
  let schemaSupportsVersioning = true;

  try {
    changes = await conn
      .execute(
        "SELECT base_version FROM changes WHERE transcript_id = ? AND revision_id = ? AND fast_mode = ? ORDER BY created_at DESC",
        [transcriptId, version, fastMode]
      )
      .then((res) => res.rows as { base_version: number }[]);
  } catch (err) {
    if (isUnknownColumnOrMissingTableError(err)) {
      console.warn(
        "[save-minutes] base_version/new_version columns missing from changes table " +
          "(schema migration pending). Skipping changes INSERT."
      );
      schemaSupportsVersioning = false;
    } else {
      throw err;
    }
  }

  const newVersion = changes.length > 0 ? changes[0].base_version + 1 : 1;
  const baseVersion = changes.length > 0 ? changes[0].base_version : 0;
  const oldContent = currentMinutes?.minutes || "";
  const diff = diffChars(oldContent, content);
  const diffContent = JSON.stringify(diff);

  await conn.transaction(async (tx) => {
    await tx.execute(
      `UPDATE minutes 
       SET minutes = ?, updated_at = NOW()
       WHERE transcript_id = ? AND user_id = ? AND version = ? AND fast_mode = ?`,
      [content, transcriptId, userId, version, fastMode]
    );

    if (schemaSupportsVersioning) {
      await tx.execute(
        `INSERT INTO changes (transcript_id, revision_id, user_id, created_at, change_type, diff_content, base_version, new_version, fast_mode)
         VALUES (?, ?, ?, NOW(), 'update', ?, ?, ?, ?)`,
        [transcriptId, version, userId, diffContent, baseVersion, newVersion, fastMode]
      );
    }
  });

  return new Response(JSON.stringify({ message: "Minutes saved successfully", version: version }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

export default withErrorReporting(handler);
