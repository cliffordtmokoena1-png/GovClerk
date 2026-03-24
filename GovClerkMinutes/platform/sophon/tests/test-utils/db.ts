import fs from "fs";
import path from "path";

export function getTestDbPath() {
  return path.join(
    process.cwd(),
    `test-sophon-${Date.now()}-${Math.random().toString(36).substring(7)}.db`
  );
}

export function cleanupTestDb(dbPath: string) {
  try {
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
    const wal = `${dbPath}-wal`;
    if (fs.existsSync(wal)) {
      fs.unlinkSync(wal);
    }
    const shm = `${dbPath}-shm`;
    if (fs.existsSync(shm)) {
      fs.unlinkSync(shm);
    }
  } catch (e) {
    console.error("Failed to cleanup test db", e);
  }
}
