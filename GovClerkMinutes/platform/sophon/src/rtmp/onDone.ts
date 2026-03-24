import type { Context } from "hono";
import { getDb } from "../sqlite3/getDb.ts";
import type { SophonWebSocket } from "../../../../src/sophon/types.ts";
import { AppEnv } from "../entrypoints/index.ts";

type RtmpIngestRow = {
  id: number;
  pid: number;
  stream_key: string;
};

export async function onDone(c: Context<AppEnv>) {
  const body = await c.req.parseBody();
  console.info("[rtmp] on-done", body);

  const name = body["name"];
  if (typeof name !== "string") {
    return c.text("OK");
  }

  const clients = c.get("clients");
  if (clients) {
    const msg = JSON.stringify({
      kind: "stream_ended",
      streamKey: name,
    } satisfies SophonWebSocket.StreamEnded);
    for (const ws of clients) {
      ws.send(msg);
    }
  }

  if (!process.env.DB_PATH) {
    return c.text("OK");
  }

  const db = getDb();
  const rows = db
    .prepare<
      string,
      RtmpIngestRow
    >("SELECT id, pid, stream_key FROM rtmp_ingests WHERE stream_key = ?")
    .all(name);

  console.info(`[rtmp] Found ${rows.length} ingest records for stream_key=${name}`, rows);

  for (const row of rows) {
    console.info(`[rtmp] Killing ingest process pid=${row.pid}`);
    process.kill(-row.pid, "SIGTERM");
    db.prepare("DELETE FROM rtmp_ingests WHERE id = ?").run(row.id);
  }

  return c.text("OK");
}
