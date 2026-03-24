import { Hono } from "hono";
import type { Context } from "hono";
import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import type { WebSocket } from "ws";
import dotenv from "dotenv";
import { crawl } from "../crawl.ts";
import { ingestManifest } from "../ingestManifest.ts";
import { findAllDotEnvPaths } from "../dotenv.ts";
import { assertString } from "../../../../src/utils/assert.ts";
import { onDone } from "../rtmp/onDone.ts";
import type { SophonWebSocket } from "../../../../src/sophon/types.ts";
import { WSContext } from "hono/ws";
import {
  getScribeSessionManager,
  HlsAudioExtractor,
  saveTranscriptSegment,
  resetSegmentIndex,
  DEFAULT_SESSION_TIMEOUT_MS,
} from "../scribe/index.ts";
import {
  endBroadcastByStreamKey,
  endStaleBroadcasts,
  getStreamKeyByBroadcastId,
  getBroadcastByStreamKey,
} from "../broadcast/db.ts";
import { RecordingPipeline } from "../recording/RecordingPipeline.ts";
import { createRecording } from "../recording/db.ts";
import { processRecording } from "../recording/processRecording.ts";
import { processNotesExport } from "../notes/processNotesExport.ts";

export type AppEnv = {
  Variables: {
    clients: Set<WSContext<WebSocket>>;
    transcriptClients: Map<string, Set<WSContext<WebSocket>>>;
  };
};

for (const envPath of findAllDotEnvPaths()) {
  dotenv.config({ path: envPath });
}

const app = new Hono<AppEnv>();

const clients = new Set<WSContext<WebSocket>>();
const transcriptClients = new Map<string, Set<WSContext<WebSocket>>>();

app.use("*", async (c, next) => {
  c.set("clients", clients);
  c.set("transcriptClients", transcriptClients);
  await next();
});

const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

app.get("/health", (c) => c.json({ ok: true }));

app.get(
  "/ws",
  upgradeWebSocket((c) => {
    return {
      onOpen(evt, ws) {
        console.info("[ws] Client connected");
        clients.add(ws);
      },
      onMessage(evt, ws) {
        try {
          const raw = typeof evt.data === "string" ? evt.data : JSON.stringify(evt.data);
          const message = JSON.parse(raw);

          if (message.kind === "ping" && message.data?.ts) {
            ws.send(
              JSON.stringify({
                kind: "pong",
                data: { ts: message.data.ts },
              })
            );
          }
        } catch (err) {
          console.error("[ws] Failed to parse message", err);
        }
      },
      onClose(evt, ws) {
        console.info("[ws] Client disconnected");
        clients.delete(ws);
      },
    };
  })
);

async function startHlsTranscription(streamKey: string): Promise<void> {
  if (hlsExtractors.has(streamKey)) {
    console.info(`[transcribe] HLS extractor already running for ${streamKey}`);
    return;
  }

  if (!process.env.ELEVEN_LABS_API_KEY) {
    console.warn("[transcribe] ELEVEN_LABS_API_KEY not set, skipping transcription");
    return;
  }

  const hlsHost =
    process.env.HLS_UPSTREAM_URL ||
    (process.env.NODE_ENV === "production" ? "http://localhost" : "http://localhost:8080");
  const hlsUrl = `${hlsHost}/hls/${streamKey}.m3u8`;

  console.info(`[transcribe] Starting HLS transcription for ${streamKey} from ${hlsUrl}`);

  const manager = getScribeSessionManager();
  const session = await manager.startSession(streamKey);

  // Configure HLS extractor with session timeout
  const extractor = new HlsAudioExtractor(hlsUrl, streamKey, {
    inactivityTimeoutMs: DEFAULT_SESSION_TIMEOUT_MS,
  });
  hlsExtractors.set(streamKey, extractor);

  extractor.on("data", (chunk) => {
    // Use manager.sendAudio to update the session's lastAudioAt timestamp
    manager.sendAudio(streamKey, chunk);
  });

  extractor.on("error", (err) => {
    console.error(`[transcribe] HLS extractor error for ${streamKey}:`, err);
  });

  extractor.on("close", () => {
    console.info(`[transcribe] HLS extractor closed for ${streamKey}`);
    hlsExtractors.delete(streamKey);
  });

  // Handle stream inactivity timeout - auto-end the broadcast
  extractor.on("timeout", () => {
    console.warn(
      `[transcribe] Stream ${streamKey} timed out due to inactivity, auto-ending broadcast`
    );

    // Notify connected clients about the timeout
    const streamClients = transcriptClients.get(streamKey);
    if (streamClients && streamClients.size > 0) {
      const msg = JSON.stringify({
        kind: "stream_timeout",
        reason: "No audio data received for 5 minutes",
        timestamp: Date.now(),
      });
      for (const ws of streamClients) {
        ws.send(msg);
      }
    }

    // Stop the extractor and end the session
    extractor.stop();
    hlsExtractors.delete(streamKey);
    manager.endSession(streamKey);
  });

  extractor.start();
}

app.get(
  "/ws/transcript/:streamKey",
  upgradeWebSocket((c) => {
    const streamKey = c.req.param("streamKey");

    return {
      onOpen(evt, ws) {
        console.info(`[ws/transcript] Client connected for stream: ${streamKey}`);
        const streamClients = transcriptClients.get(streamKey) || new Set();
        streamClients.add(ws);
        transcriptClients.set(streamKey, streamClients);

        if (!hlsExtractors.has(streamKey)) {
          console.info(`[ws/transcript] Auto-starting transcription for ${streamKey}`);
          startHlsTranscription(streamKey).catch((err) => {
            console.error("[ws/transcript] Failed to auto-start transcription:", err);
          });
        }
      },
      onMessage(evt, ws) {
        try {
          const raw = typeof evt.data === "string" ? evt.data : JSON.stringify(evt.data);
          const message = JSON.parse(raw);
          if (message.kind === "ping") {
            ws.send(JSON.stringify({ kind: "pong", ts: Date.now() }));
          }
        } catch {
          // Ignore non-JSON messages
        }
      },
      onClose(evt, ws) {
        console.info(`[ws/transcript] Client disconnected for stream: ${streamKey}`);
        const streamClients = transcriptClients.get(streamKey);
        if (streamClients) {
          streamClients.delete(ws);
          if (streamClients.size === 0) {
            transcriptClients.delete(streamKey);
          }
        }
      },
    };
  })
);

// Public endpoint using broadcast ID instead of stream key
app.get(
  "/ws/transcript/broadcast/:broadcastId",
  upgradeWebSocket((c) => {
    const broadcastIdParam = c.req.param("broadcastId");
    const broadcastId = Number(broadcastIdParam);

    return {
      async onOpen(evt, ws) {
        if (!Number.isInteger(broadcastId) || broadcastId <= 0) {
          console.warn(`[ws/transcript/broadcast] Invalid broadcast ID: ${broadcastIdParam}`);
          ws.close(1008, "Invalid broadcast ID");
          return;
        }

        const streamKey = await getStreamKeyByBroadcastId(broadcastId);
        if (!streamKey) {
          console.warn(`[ws/transcript/broadcast] Broadcast not found: ${broadcastId}`);
          ws.close(1008, "Broadcast not found");
          return;
        }

        console.info(
          `[ws/transcript/broadcast] Client connected for broadcast ${broadcastId} (stream: ${streamKey})`
        );
        const streamClients = transcriptClients.get(streamKey) || new Set();
        streamClients.add(ws);
        transcriptClients.set(streamKey, streamClients);

        if (!hlsExtractors.has(streamKey)) {
          console.info(`[ws/transcript/broadcast] Auto-starting transcription for ${streamKey}`);
          startHlsTranscription(streamKey).catch((err) => {
            console.error("[ws/transcript/broadcast] Failed to auto-start transcription:", err);
          });
        }
      },
      onMessage(evt, ws) {
        try {
          const raw = typeof evt.data === "string" ? evt.data : JSON.stringify(evt.data);
          const message = JSON.parse(raw);
          if (message.kind === "ping") {
            ws.send(JSON.stringify({ kind: "pong", ts: Date.now() }));
          }
        } catch {
          // Ignore non-JSON messages
        }
      },
      onClose(evt, ws) {
        // We need to look up the stream key again to properly clean up
        getStreamKeyByBroadcastId(broadcastId).then((streamKey) => {
          if (!streamKey) return;

          console.info(
            `[ws/transcript/broadcast] Client disconnected for broadcast ${broadcastId} (stream: ${streamKey})`
          );
          const streamClients = transcriptClients.get(streamKey);
          if (streamClients) {
            streamClients.delete(ws);
            if (streamClients.size === 0) {
              transcriptClients.delete(streamKey);
            }
          }
        });
      },
    };
  })
);

app.post("/transcribe/start", async (c) => {
  try {
    const { streamKey } = await c.req.json<{ streamKey: string }>();
    if (!streamKey) {
      return c.json({ error: "streamKey is required" }, 400);
    }

    await startHlsTranscription(streamKey);

    console.info(`[transcribe] Started HLS transcription for ${streamKey}`);
    return c.json({ ok: true, streamKey });
  } catch (err) {
    console.error("[transcribe] Error starting session:", err);
    return c.json({ error: String(err) }, 500);
  }
});

app.post("/transcribe/audio", async (c) => {
  const streamKey = c.req.header("X-Stream-Key");
  if (!streamKey) {
    return c.json({ error: "X-Stream-Key header is required" }, 400);
  }

  const manager = getScribeSessionManager();
  const session = manager.getSession(streamKey);
  if (!session) {
    return c.json({ error: "No active session for stream key" }, 404);
  }

  const audioData = await c.req.arrayBuffer();
  session.sendAudio(Buffer.from(audioData));

  return c.json({ ok: true });
});

app.post("/transcribe/end", async (c) => {
  try {
    const { streamKey } = await c.req.json<{ streamKey: string }>();
    if (!streamKey) {
      return c.json({ error: "streamKey is required" }, 400);
    }

    const manager = getScribeSessionManager();
    manager.endSession(streamKey);

    const extractor = hlsExtractors.get(streamKey);
    if (extractor) {
      extractor.stop();
      hlsExtractors.delete(streamKey);
    }

    console.info(`[transcribe] Ended session for ${streamKey}`);
    return c.json({ ok: true, streamKey });
  } catch (err) {
    console.error("[transcribe] Error ending session:", err);
    return c.json({ error: String(err) }, 500);
  }
});

type MarkerType =
  | "go_live"
  | "pause"
  | "resume"
  | "end"
  | "agenda_clicked"
  | "agenda_completed"
  | "motion_added";

app.post("/transcribe/marker", async (c) => {
  try {
    const { streamKey, markerType, label, agendaItemId, motionId } = await c.req.json<{
      streamKey: string;
      markerType: MarkerType;
      label?: string;
      agendaItemId?: number;
      motionId?: number;
    }>();

    if (!streamKey) {
      return c.json({ error: "streamKey is required" }, 400);
    }
    if (!markerType) {
      return c.json({ error: "markerType is required" }, 400);
    }

    const streamClients = transcriptClients.get(streamKey);
    if (streamClients && streamClients.size > 0) {
      const msg = JSON.stringify({
        kind: "transcript_marker",
        markerType,
        timestamp: Date.now(),
        label,
        agendaItemId,
        motionId,
      });

      for (const ws of streamClients) {
        ws.send(msg);
      }
    }

    console.info(`[transcribe] Sent ${markerType} marker for ${streamKey}`);
    return c.json({ ok: true, streamKey, markerType });
  } catch (err) {
    console.error("[transcribe] Error sending marker:", err);
    return c.json({ error: String(err) }, 500);
  }
});

type NotifyType = "broadcast_update" | "agenda_update";

app.post("/transcribe/notify", async (c) => {
  try {
    const {
      streamKey,
      notifyType,
      broadcastId,
      meetingId,
      currentAgendaItemId,
      status,
      agendaTimestamps,
    } = await c.req.json<{
      streamKey: string;
      notifyType: NotifyType;
      broadcastId?: number;
      meetingId?: number;
      currentAgendaItemId?: number | null;
      status?: string;
      agendaTimestamps?: Array<{
        agendaItemId: number;
        activatedAt: string;
        recordingPositionMs: number | null;
      }>;
    }>();

    if (!streamKey) {
      return c.json({ error: "streamKey is required" }, 400);
    }
    if (!notifyType) {
      return c.json({ error: "notifyType is required" }, 400);
    }

    const streamClients = transcriptClients.get(streamKey);
    console.info(
      `[transcribe/notify] streamKey=${streamKey}, notifyType=${notifyType}, connectedClients=${streamClients?.size ?? 0}`
    );

    if (streamClients && streamClients.size > 0) {
      let msg: string;

      if (notifyType === "broadcast_update") {
        msg = JSON.stringify({
          kind: "broadcast_update",
          broadcastId,
          currentAgendaItemId,
          status,
          agendaTimestamps,
        });
      } else if (notifyType === "agenda_update") {
        msg = JSON.stringify({
          kind: "agenda_update",
          meetingId,
        });
      } else {
        return c.json({ error: "Invalid notifyType" }, 400);
      }

      for (const ws of streamClients) {
        ws.send(msg);
      }
    }

    console.info(`[transcribe] Sent ${notifyType} notification for ${streamKey}`);
    return c.json({ ok: true, streamKey, notifyType });
  } catch (err) {
    console.error("[transcribe] Error sending notification:", err);
    return c.json({ error: String(err) }, 500);
  }
});

app.post("/recording/start", async (c) => {
  const { streamKey } = await c.req.json<{ streamKey: string }>();
  if (!streamKey) return c.json({ error: "streamKey required" }, 400);

  if (activeRecordings.has(streamKey)) {
    return c.json({ error: "Recording already in progress" }, 409);
  }

  // Lookup broadcast context
  const broadcast = await getBroadcastByStreamKey(streamKey);
  if (!broadcast) return c.json({ error: "Broadcast not found" }, 404);

  // Create recording record
  const recordingId = await createRecording(broadcast.id, streamKey);

  // Generate S3 key using org/meeting context
  const s3Key = `portal/${broadcast.orgId}/${broadcast.meetingId}/meeting_recording_${Date.now()}.mp4`;

  // Start pipeline
  const rtmpUrl = `rtmp://localhost/live/${streamKey}`;
  const pipeline = new RecordingPipeline({
    streamKey,
    recordingId,
    rtmpUrl,
    s3Key,
    meetingId: broadcast.meetingId,
  });

  pipeline.on("end", () => {
    activeRecordings.delete(streamKey);
  });
  pipeline.on("error", (err) => {
    console.error(`[recording] Error:`, err);
  });

  activeRecordings.set(streamKey, pipeline);
  await pipeline.start();

  return c.json({ ok: true, recordingId, s3Key });
});

app.post("/recording/end", async (c) => {
  const { streamKey } = await c.req.json<{ streamKey: string }>();
  if (!streamKey) return c.json({ error: "streamKey required" }, 400);

  const pipeline = activeRecordings.get(streamKey);
  if (!pipeline) return c.json({ error: "No active recording" }, 404);

  await pipeline.stop(); // Graceful stop, completes S3 upload
  activeRecordings.delete(streamKey);

  // Trigger post-processing asynchronously
  processRecording(pipeline.recordingId).catch((err) => {
    console.error("[recording] Post-processing failed:", err);
  });

  return c.json({ ok: true });
});

app.post("/recording/reprocess", async (c) => {
  const { recordingId } = await c.req.json<{ recordingId: number }>();
  if (!recordingId) return c.json({ error: "recordingId required" }, 400);

  // Re-run processing (idempotent)
  processRecording(recordingId).catch((err) => {
    console.error("[recording] Reprocessing failed:", err);
  });

  return c.json({ ok: true });
});

app.post("/broadcast/:id/export-notes", async (c) => {
  const idParam = c.req.param("id");
  const broadcastId = Number(idParam);

  if (isNaN(broadcastId)) {
    return c.json({ error: "Invalid broadcast ID" }, 400);
  }

  const result = await processNotesExport(broadcastId);

  if (result.success && "skipped" in result) {
    return c.json({ success: true, skipped: true, reason: result.reason }, 200);
  }
  if (result.success) {
    return c.json({ success: true }, 200);
  }
  if (result.error === "not_found") {
    return c.json({ error: "Broadcast not found" }, 404);
  }
  // result.error === "export_failed"
  return c.json({ error: `Failed to export notes: ${result.message}` }, 500);
});

const hlsExtractors = new Map<string, HlsAudioExtractor>();

// Track active recordings
const activeRecordings = new Map<string, RecordingPipeline>();

app.post("/rtmp/on-publish", async (c) => {
  const clients = c.get("clients");
  const body = await c.req.parseBody();
  console.info("[rtmp] on-publish", body);

  const streamKey = body["name"];
  if (typeof streamKey === "string") {
    const msg = JSON.stringify({
      kind: "stream_started",
      streamKey,
    } satisfies SophonWebSocket.StreamStarted);
    for (const ws of clients) {
      ws.send(msg);
    }

    if (process.env.ELEVEN_LABS_API_KEY) {
      setTimeout(() => {
        startHlsTranscription(streamKey).catch((err) => {
          console.error(`[transcribe] Failed to start HLS transcription for ${streamKey}:`, err);
        });
      }, 5000);
    }

    // Cancel reconnection grace period if active
    const pipeline = activeRecordings.get(streamKey);
    if (pipeline) {
      console.info(`[recording] Stream reconnected: ${streamKey}`);
      pipeline.cancelReconnectionGracePeriod();
    }
  }

  return c.text("OK");
});

app.post("/rtmp/on-done", async (c) => {
  const result = await onDone(c);

  const body = await c.req.parseBody();
  const streamKey = body["name"];

  if (typeof streamKey === "string") {
    const extractor = hlsExtractors.get(streamKey);
    if (extractor) {
      console.info(`[transcribe] Stopping HLS extractor for ${streamKey}`);
      extractor.stop();
      hlsExtractors.delete(streamKey);
    }

    if (process.env.ELEVEN_LABS_API_KEY) {
      try {
        const manager = getScribeSessionManager();
        manager.endSession(streamKey);
        console.info(`[transcribe] Ended Scribe session for ${streamKey}`);
      } catch (err) {
        console.error(`[transcribe] Error ending Scribe session for ${streamKey}:`, err);
      }
    }

    // Recording reconnection grace period
    const pipeline = activeRecordings.get(streamKey);
    if (pipeline && pipeline.running) {
      console.info(`[recording] Connection closed for ${streamKey}, starting 60s grace period`);
      pipeline.startReconnectionGracePeriod(60000, () => {
        // Grace period expired without reconnect
        if (!pipeline.running) {
          console.info(
            `[recording] Grace period callback for ${streamKey} skipped; pipeline already stopped`
          );
          return;
        }
        console.info(`[recording] Grace period expired for ${streamKey}, finalizing`);
        pipeline
          .stop()
          .then(() => {
            activeRecordings.delete(streamKey);
            // Trigger post-processing
            processRecording(pipeline.recordingId).catch((err) => {
              console.error("[recording] Post-processing failed:", err);
            });
          })
          .catch((err) => {
            console.error("[recording] Failed to stop pipeline:", err);
          });
      });
    }
  }

  return result;
});

app.get("/crawl", async (c: Context) => {
  const root = c.req.query("url");
  if (!root) {
    return c.json({ error: "Missing required query param `url`" }, 400);
  }
  const maxDepth = Number(c.req.query("maxDepth") || 1);
  const maxBreadth = Number(c.req.query("maxBreadth") || 5);
  const manifest = await crawl({ root, maxDepth, maxBreadth });

  const ingestFlag = c.req.query("ingest");
  const orgIdParam = c.req.query("orgId");
  if (ingestFlag === "1" && orgIdParam) {
    const orgId = Number(orgIdParam);
    if (!Number.isNaN(orgId) && orgId > 0) {
      try {
        await ingestManifest(manifest, orgId);
      } catch (err) {
        console.error("[crawler] Ingestion failed:", err);
      }
    }
  }

  return c.json(manifest);
});

const HLS_UPSTREAM =
  process.env.HLS_UPSTREAM_URL ||
  (process.env.NODE_ENV === "production" ? "http://localhost" : "http://localhost:8080");
console.info(`[hls] HLS proxy configured to upstream: ${HLS_UPSTREAM}`);

// Public HLS endpoint using broadcast ID - mirrors the WebSocket pattern
// This keeps streamKey hidden from public viewers
app.get("/hls/broadcast/:broadcastId", async (c) => {
  const broadcastIdParam = c.req.param("broadcastId");

  if (!broadcastIdParam.endsWith(".m3u8")) {
    return c.text("Not found", 404);
  }

  const broadcastId = Number(broadcastIdParam.replace(/\.m3u8$/, ""));

  if (!Number.isInteger(broadcastId) || broadcastId <= 0) {
    console.warn(`[hls/broadcast] Invalid broadcast ID: ${broadcastIdParam}`);
    return c.text("Invalid broadcast ID", 400);
  }

  const streamKey = await getStreamKeyByBroadcastId(broadcastId);
  if (!streamKey) {
    console.warn(`[hls/broadcast] Broadcast not found: ${broadcastId}`);
    return c.text("Broadcast not found", 404);
  }

  const upstreamUrl = `${HLS_UPSTREAM}/hls/${streamKey}.m3u8`;
  try {
    console.info(`[hls/broadcast] Proxying broadcast ${broadcastId} to ${upstreamUrl}`);
    const response = await fetch(upstreamUrl);
    if (!response.ok) {
      console.warn(
        `[hls/broadcast] Upstream returned ${response.status} for broadcast ${broadcastId}`
      );
      return c.text("Stream not available", 404);
    }

    let playlist = await response.text();
    playlist = playlist.replace(/^([^#\n]+\.ts)$/gm, `/hls/$1`);

    return c.body(playlist, 200, {
      "Content-Type": "application/vnd.apple.mpegurl",
      "Cache-Control": "no-cache",
      "Access-Control-Allow-Origin": "*",
    });
  } catch (err) {
    console.error(`[hls/broadcast] Proxy error for broadcast ${broadcastId}:`, err);
    return c.text("Upstream error", 502);
  }
});

app.get("/hls/:file", async (c) => {
  const file = c.req.param("file");
  const upstreamUrl = `${HLS_UPSTREAM}/hls/${file}`;

  try {
    console.info(`[hls] Proxying request for ${file} to ${upstreamUrl}`);
    const response = await fetch(upstreamUrl);
    if (!response.ok) {
      console.warn(`[hls] Upstream returned ${response.status} for ${file}`);
      return c.text("Not found", 404);
    }

    let contentType = "application/octet-stream";
    if (file.endsWith(".m3u8")) {
      contentType = "application/vnd.apple.mpegurl";
    } else if (file.endsWith(".ts")) {
      contentType = "video/mp2t";
    }

    const body = await response.arrayBuffer();
    return c.body(body, 200, {
      "Content-Type": contentType,
      "Cache-Control": "no-cache",
      "Access-Control-Allow-Origin": "*",
    });
  } catch (err) {
    console.error(`[hls] Proxy error for ${file}:`, err);
    return c.text("Upstream error", 502);
  }
});

const port = Number(process.env.PORT || 3000);
const server = serve({
  fetch: app.fetch,
  port,
});

injectWebSocket(server);

if (process.env.ELEVEN_LABS_API_KEY) {
  try {
    const manager = getScribeSessionManager();

    manager.on("transcript", ({ streamKey, segment, sessionStartedAt }) => {
      if (segment.isFinal) {
        const startTime = segment.words?.find((w) => w.start !== undefined)?.start ?? null;
        const wordsWithEnd = segment.words?.filter((w) => w.end !== undefined) ?? [];
        const endTime =
          wordsWithEnd.length > 0 ? (wordsWithEnd[wordsWithEnd.length - 1].end ?? null) : null;

        saveTranscriptSegment({
          streamKey,
          segmentId: segment.segmentId,
          speaker: segment.speaker,
          text: segment.text,
          startTime,
          endTime,
          words: segment.words,
        }).catch((err) => {
          console.error(`[transcribe] Failed to save segment to DB:`, err);
        });
      }

      const streamClients = transcriptClients.get(streamKey);
      if (streamClients && streamClients.size > 0) {
        const msg = JSON.stringify({
          kind: "transcript_segment",
          segmentId: segment.segmentId,
          speaker: segment.speaker,
          text: segment.text,
          isFinal: segment.isFinal,
          languageCode: segment.languageCode,
          words: segment.words,
          sessionStartedAt,
        } satisfies SophonWebSocket.TranscriptSegment);

        for (const ws of streamClients) {
          ws.send(msg);
        }
      }
    });

    manager.on("error", ({ streamKey, error }) => {
      console.error(`[transcribe] Error for ${streamKey}:`, error);
    });

    // Handle session timeout - notify clients when session is auto-ended
    manager.on("sessionTimeout", ({ streamKey, inactiveForMs }) => {
      console.warn(
        `[transcribe] Session ${streamKey} auto-ended after ${(inactiveForMs / 1000).toFixed(1)}s of inactivity`
      );

      // Wrap in async IIFE - the entire block is fire-and-forget
      void (async () => {
        // Step 1: Get broadcastId BEFORE any state changes
        // (getBroadcastByStreamKey filters by non-ended status)
        const broadcast = await getBroadcastByStreamKey(streamKey);
        const broadcastId = broadcast?.id;

        // Step 2: ORIGINAL OPERATIONS IN ORIGINAL ORDER
        resetSegmentIndex(streamKey);

        await endBroadcastByStreamKey(streamKey).catch((err) => {
          console.error(`[transcribe] Failed to end broadcast in database for ${streamKey}:`, err);
        });

        // WebSocket notification
        const streamClients = transcriptClients.get(streamKey);
        if (streamClients && streamClients.size > 0) {
          const msg = JSON.stringify({
            kind: "stream_timeout",
            reason: `Session auto-ended after ${(inactiveForMs / 1000).toFixed(0)} seconds of inactivity`,
            timestamp: Date.now(),
          } satisfies SophonWebSocket.StreamTimeout);

          for (const ws of streamClients) {
            ws.send(msg);
          }
        }

        // HLS cleanup
        const extractor = hlsExtractors.get(streamKey);
        if (extractor) {
          extractor.stop();
          hlsExtractors.delete(streamKey);
        }

        // Step 3: NEW - Trigger notes export AFTER all cleanup (fire-and-forget)
        if (broadcastId) {
          processNotesExport(broadcastId).then((result) => {
            if (!result.success) {
              console.error(`[notes] Failed to export notes for broadcast ${broadcastId}:`, result);
            }
          });
        }
      })();
    });

    console.info(
      "[transcribe] Real-time transcription enabled (with diarization and session timeouts)"
    );
  } catch (err) {
    console.warn("[transcribe] Failed to initialize:", err);
  }
} else {
  console.info("[transcribe] ELEVEN_LABS_API_KEY not set, real-time transcription disabled");
}

endStaleBroadcasts(5)
  .then((count) => {
    if (count > 0) {
      console.info(`[sophon] Cleaned up ${count} stale broadcast(s) on startup`);
    }
  })
  .catch((err) => {
    console.warn("[sophon] Failed to clean up stale broadcasts on startup:", err);
  });

console.info(`[sophon] Listening on http://localhost:${port}`);

const shutdown = () => {
  console.info("\n[sophon] Shutting down...");

  for (const [streamKey, extractor] of hlsExtractors) {
    console.info(`[shutdown] Stopping HLS extractor for ${streamKey}`);
    extractor.stop();
  }
  hlsExtractors.clear();

  if (process.env.ELEVEN_LABS_API_KEY) {
    try {
      const manager = getScribeSessionManager();
      manager.destroy(); // Use destroy() to also clean up the timeout checker
    } catch {}
  }

  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
