import { connect, type Connection } from "@planetscale/database";

let connection: Connection | null = null;

export function getDb(): Connection {
  if (!connection) {
    const host = process.env.PLANETSCALE_DB_HOST;
    const username = process.env.PLANETSCALE_DB_USERNAME;
    const password = process.env.PLANETSCALE_DB_PASSWORD;

    if (!host || !username || !password) {
      throw new Error(
        "Missing PlanetScale credentials. Ensure PLANETSCALE_DB_HOST, PLANETSCALE_DB_USERNAME, and PLANETSCALE_DB_PASSWORD are set."
      );
    }

    connection = connect({ host, username, password });
  }
  return connection;
}
