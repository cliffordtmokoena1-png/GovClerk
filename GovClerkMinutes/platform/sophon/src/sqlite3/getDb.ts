import Database from "better-sqlite3";
import { assertString } from "../../../../src/utils/assert.ts";

export function getDb(): Database.Database {
  const db = new Database(assertString(process.env.DB_PATH, "DB_PATH env var required"));
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS rtmp_ingests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      pid INTEGER,
      stream_key TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_rtmp_ingests_stream_key
      ON rtmp_ingests(stream_key);
  `);
  return db;
}
