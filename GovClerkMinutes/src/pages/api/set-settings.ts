import { getAuth } from "@clerk/nextjs/server";
import { connect } from "@planetscale/database";
import withErrorReporting from "@/error/withErrorReporting";
import { NextRequest } from "next/server";

export const config = {
  runtime: "edge",
};

type Body = {
  key: string;
  value: unknown;
};

async function handler(req: NextRequest) {
  const { userId } = getAuth(req);
  if (userId == null) {
    return new Response(null, { status: 401 });
  }

  const body = (await req.json()) as Body;

  const { key, value } = body;

  const ALLOWED_KEYS = ["send-email-when-minutes-done", "selected-template-id"] as const;
  if (!ALLOWED_KEYS.includes(key as (typeof ALLOWED_KEYS)[number])) {
    return new Response(JSON.stringify({ error: "Invalid setting key" }), { status: 400 });
  }

  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  await conn.execute(
    `
      INSERT INTO gc_settings (user_id, setting_key, setting_value)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE
        setting_value = VALUES(setting_value)
    `,
    [userId, key, JSON.stringify(value)]
  );

  return new Response(null, { status: 204 });
}

export default withErrorReporting(handler);
