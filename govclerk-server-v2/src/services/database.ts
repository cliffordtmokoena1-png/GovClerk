import mysql from 'mysql2/promise';

let pool: mysql.Pool | null = null;

export function getDb(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.PLANETSCALE_DB_HOST!,
      user: process.env.PLANETSCALE_DB_USERNAME!,
      password: process.env.PLANETSCALE_DB_PASSWORD!,
      database: process.env.PLANETSCALE_DB!,
      ssl: { rejectUnauthorized: true },
      waitForConnections: true,
      connectionLimit: 10,
    });
  }
  return pool;
}

export async function query<T = any>(sql: string, params?: any[]): Promise<T[]> {
  const db = getDb();
  const [rows] = await db.execute(sql, params);
  return rows as T[];
}

export async function execute(sql: string, params?: any[]): Promise<mysql.ResultSetHeader> {
  const db = getDb();
  const [result] = await db.execute(sql, params);
  return result as mysql.ResultSetHeader;
}
