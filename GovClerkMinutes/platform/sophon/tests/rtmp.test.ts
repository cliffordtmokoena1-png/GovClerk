import { describe, test, expect, beforeAll, afterAll } from "@jest/globals";
import { spawn } from "child_process";
import { buildServer, startServer, waitForHealth } from "./test-utils/server.ts";
import { getDb } from "../src/sqlite3/getDb.ts";
import { getTestDbPath, cleanupTestDb } from "./test-utils/db.ts";

let proc: any;
const PORT = 8900;
const BASE = `http://localhost:${PORT}`;
const DB_PATH = getTestDbPath();

describe("rtmp endpoints", () => {
  beforeAll(async () => {
    process.env.DB_PATH = DB_PATH;
    await buildServer();
    proc = startServer(PORT, { DB_PATH });
    await waitForHealth(BASE);
  });

  afterAll(() => {
    if (proc) {
      proc.kill();
    }
    cleanupTestDb(DB_PATH);
  });

  test("POST /rtmp/on-done kills process and removes from db", async () => {
    const streamKey = "test-stream-key-" + Date.now();

    // 1. Spawn a dummy process (sleep)
    // Use 'sleep' command which should be available on macOS/Linux
    const dummyProc = spawn("sleep", ["10"]);
    const pid = dummyProc.pid;
    if (!pid) {
      throw new Error("Failed to spawn dummy process");
    }

    // 2. Insert into DB
    // Note: The test runner (Bun) and the server (Node) must share the same DB file.
    // We use better-sqlite3 here, but share the schema logic.
    const db = getDb();

    db.prepare("INSERT INTO rtmp_ingests (pid, stream_key) VALUES (?, ?)").run(pid, streamKey);

    // Verify it's in DB
    const rowBefore = db.prepare("SELECT * FROM rtmp_ingests WHERE pid = ?").get(pid);
    expect(rowBefore).toBeTruthy();

    // 3. Call on-done
    const params = new URLSearchParams();
    params.append("name", streamKey);
    params.append("call", "done");

    const res = await fetch(`${BASE}/rtmp/on-done`, {
      method: "POST",
      body: params,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
    expect(res.status).toBe(200);

    // 4. Verify process is killed
    // Wait a bit for the server to process
    await new Promise((r) => setTimeout(r, 1000));

    let isRunning = true;
    try {
      // signal 0 checks if process exists
      process.kill(pid, 0);
    } catch (e) {
      isRunning = false;
    }
    expect(isRunning).toBe(false);

    // 5. Verify row is deleted
    const rowAfter = db.prepare("SELECT * FROM rtmp_ingests WHERE pid = ?").get(pid);
    expect(rowAfter).toBeFalsy();

    db.close();

    // Cleanup if it wasn't killed
    if (isRunning) {
      dummyProc.kill();
    }
  });
});
