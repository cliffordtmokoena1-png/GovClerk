import { connect } from "@planetscale/database";
import { getAuth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { capture } from "@/utils/posthog";
import withErrorReporting from "@/error/withErrorReporting";
import { canAccessResource } from "@/utils/resourceAccess";
import { getSiteFromHeaders } from "@/utils/site";

export const config = {
  runtime: "edge",
};

async function handler(req: NextRequest) {
  const { userId } = getAuth(req);
  if (userId == null) {
    return new Response(null, { status: 401 });
  }

  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  const body = await req.json();
  const transcriptId = body.transcriptId as number;
  const title = body.title as string;
  const posthog_session_id = req.headers.get("x-posthog-session-id");

  if (!transcriptId || !title) {
    return new Response(JSON.stringify({ error: "Missing required fields" }), {
      status: 400,
    });
  }

  // Check if user can access this transcript
  const site = getSiteFromHeaders(req.headers);
  const hasAccess = await canAccessResource("transcripts", transcriptId, userId, site);
  if (!hasAccess) {
    return new Response(JSON.stringify({ error: "Access denied" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  await conn.execute("UPDATE transcripts SET title = ? WHERE id = ?", [title, transcriptId]);

  await capture(
    "transcript_renamed",
    {
      transcript_id: transcriptId,
      $session_id: posthog_session_id,
    },
    userId
  );

  return new Response(null, {
    status: 200,
  });
}

export default withErrorReporting(handler);
