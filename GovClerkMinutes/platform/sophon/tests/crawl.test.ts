import { jest, describe, test, expect, beforeAll, afterAll } from "@jest/globals";
import { buildServer, startServer, waitForHealth } from "./test-utils/server.ts";

let proc: any;
const PORT = 8898;
const BASE = `http://localhost:${PORT}`;

describe("/crawl endpoint", () => {
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

  test.skip("crawls websterny.gov and returns a manifest with meetings and artifacts", async () => {
    const res = await fetch(`${BASE}/crawl?url=https://www.websterny.gov&maxDepth=1&maxBreadth=5`);
    expect(res.status).toBe(200);
    const manifest = (await res.json()) as {
      orgName: string;
      domain: string;
      logo?: { key: string };
      meetings: Array<{
        title: string;
        kind: string;
        date: string;
        artifacts: Array<{ kind: string; key: string }>;
      }>;
    };
    console.info("[test] Final Manifest (websterny):", JSON.stringify(manifest, null, 2));

    expect(manifest.domain).toContain("websterny.gov");
    expect(Array.isArray(manifest.meetings)).toBe(true);
    expect(manifest.meetings.length).toBeGreaterThan(0);
    const allowedKinds = [
      "agenda",
      "minutes",
      "agenda_packet",
      "minutes_packet",
      "agenda_html",
      "minutes_html",
      "media",
    ];
    const hasDocs = manifest.meetings.some((m) =>
      (m.artifacts || []).some(
        (a) =>
          allowedKinds.includes(a.kind) && typeof a.key === "string" && a.key.startsWith("http")
      )
    );
    expect(hasDocs).toBe(true);
  });

  test.skip("crawls menandsny.gov and returns a manifest with meetings and artifacts", async () => {
    const res = await fetch(`${BASE}/crawl?url=https://menandsny.gov/&maxDepth=2&maxBreadth=4`);
    expect(res.status).toBe(200);
    const manifest = (await res.json()) as {
      orgName: string;
      domain: string;
      logo?: { key: string };
      meetings: Array<{
        title: string;
        kind: string;
        date: string;
        artifacts: Array<{ kind: string; key: string }>;
      }>;
    };
    console.info("[test] Final Manifest (menandsny):", JSON.stringify(manifest, null, 2));

    expect(manifest.domain).toContain("menandsny.gov");
    expect(Array.isArray(manifest.meetings)).toBe(true);
    expect(manifest.meetings.length).toBeGreaterThan(0);
    const allowedKinds = [
      "agenda",
      "minutes",
      "agenda_packet",
      "minutes_packet",
      "agenda_html",
      "minutes_html",
      "media",
    ];
    const hasDocs = manifest.meetings.some((m) =>
      (m.artifacts || []).some(
        (a) =>
          allowedKinds.includes(a.kind) && typeof a.key === "string" && a.key.startsWith("http")
      )
    );
    expect(hasDocs).toBe(true);
  });
});
