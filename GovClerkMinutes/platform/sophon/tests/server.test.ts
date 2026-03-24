import { jest, describe, test, expect, beforeAll, afterAll } from "@jest/globals";
import { buildServer, startServer, waitForHealth } from "./test-utils/server.ts";

let proc: any;
const PORT = 8899;
const BASE = `http://localhost:${PORT}`;

describe("crawler server", () => {
  beforeAll(async () => {
    await buildServer();
    proc = startServer(PORT);
    await waitForHealth(BASE);
  });

  afterAll(() => {
    if (proc) {
      proc.kill();
    }
  });

  test("GET /health returns ok", async () => {
    const res = await fetch(`${BASE}/health`);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ ok: true });
  });
});
