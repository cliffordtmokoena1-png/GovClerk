import { jest, describe, test, expect, beforeAll, afterAll } from "@jest/globals";
import { WebSocket } from "ws";
import { buildServer, startServer, waitForHealth } from "./test-utils/server.ts";

let proc: any;
const PORT = 8890;
const BASE = `http://localhost:${PORT}`;
const WS_URL = `ws://localhost:${PORT}/ws`;

describe("websocket server", () => {
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

  test("connects and responds to heartbeat", async () => {
    const ws = new WebSocket(WS_URL);

    const openPromise = new Promise<void>((resolve) => {
      ws.on("open", () => resolve());
    });

    await openPromise;
    expect(ws.readyState).toBe(WebSocket.OPEN);

    const messagePromise = new Promise<any>((resolve) => {
      ws.on("message", (data) => {
        resolve(JSON.parse(data.toString()));
      });
    });

    const ts = Date.now();
    ws.send(JSON.stringify({ kind: "ping", data: { ts } }));

    const response = await messagePromise;
    expect(response).toEqual({ kind: "pong", data: { ts } });

    ws.close();
  });
});
