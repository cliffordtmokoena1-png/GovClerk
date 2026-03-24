import withErrorReporting from "@/error/withErrorReporting";
import { getAuth } from "@clerk/nextjs/server";
import { connect } from "@planetscale/database";
import { NextRequest } from "next/server";

export const config = {
  runtime: "edge",
};

async function handler(req: NextRequest) {
  const { userId } = getAuth(req);
  if (userId == null) {
    return new Response(null, { status: 401 });
  }

  const body = await req.json();
  const transcriptId = body.transcriptId as number;
  const rating = body.rating as "up" | "down";
  const msWordClick = body.msWordClick as boolean;
  const copyClick = body.copyClick as boolean;

  let ratingSql = "";
  if (rating === "up") {
    ratingSql = 'rating = "up",';
  } else if (rating === "down") {
    ratingSql = 'rating = "down",';
  }

  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  const [_, hasReviewed] = await Promise.all([
    conn.execute(
      `UPDATE minutes SET ${ratingSql} ms_word_clicks = ms_word_clicks + ?, copy_clicks = copy_clicks + ? WHERE transcript_id = ? AND user_id = ?;`,
      [msWordClick ? 1 : 0, copyClick ? 1 : 0, transcriptId, userId]
    ),
    conn
      .execute("SELECT COUNT(1) as cnt FROM gc_reviews WHERE user_id = ?;", [userId])
      .then((res) => res.rows[0].cnt > 0),
  ]);

  return new Response(JSON.stringify({ transcriptId, hasReviewed }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

export default withErrorReporting(handler);
