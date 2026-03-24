import mysql2, { Connection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

// let connection: Connection | null = null;

// TODO: connection pooling, reuse, handle reconnect
export async function getConnection(): Promise<Connection> {
  // if (connection != null) {
  //   return connection;
  // }
  // connection = await mysql2.createConnection({
  return mysql2.createConnection({
    host: process.env.PLANETSCALE_DB_HOST,
    user: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
    database: process.env.PLANETSCALE_DB,
    ssl: {
      rejectUnauthorized: true,
    },
    dateStrings: true,
  });
}

export async function dbQuery(query: string, values: unknown[]): Promise<RowDataPacket> {
  const [rows, fields] = await (await getConnection()).execute(query, values);
  return rows as RowDataPacket;
}

export async function dbInsert(query: string, values: unknown[]): Promise<ResultSetHeader> {
  const [rows] = await (await getConnection()).query(query, values);
  return rows as ResultSetHeader;
}
