import { connect } from "@planetscale/database";

// Call this from a server cotext to map `gc_...` auth tokens to a user ID, or
// return undefined if no mapping exists or is expired.
export default async function getUserIdFromToken(token: string): Promise<string | undefined> {
  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  const rows = await conn
    .execute(
      "SELECT user_id FROM gc_auth_tokens WHERE token = ? AND expires_at > UTC_TIMESTAMP();",
      [token]
    )
    .then((res) => res.rows);

  if (rows.length === 0) {
    return undefined;
  }

  return rows[0].user_id as string;
}
