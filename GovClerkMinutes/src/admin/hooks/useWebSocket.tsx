import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  useEffect,
} from "react";

// --- Types ---

export type WSStatus = "idle" | "connecting" | "open" | "closing" | "closed" | "error";

export type RetryPolicy = {
  maxRetries?: number;
  minDelayMs?: number;
  maxDelayMs?: number;
  factor?: number;
};

export type HeartbeatOptions = {
  intervalMs?: number;
  pingPayload?: Record<string, unknown>;
};

// Generic subscribe params
export type SubscribeParams<In> = {
  onMessage?: (msg: In) => void;
  onConnect?: () => void | (() => void);
};

export type WebSocketProviderProps = {
  retry?: RetryPolicy;
  heartbeat?: HeartbeatOptions;
  debug?: boolean;
  children: React.ReactNode;
};

// A "Session" represents one active WebSocket connection for a specific URL
type SocketSession = {
  url: string;
  ws: WebSocket | null;
  status: WSStatus;
  error: Event | Error | null;
  queue: unknown[];
  subscribers: Set<SubscribeParams<unknown>>;
  // We need internal listeners to notify hooks when status changes
  statusListeners: Set<(status: WSStatus, error: Event | Error | null) => void>;
  cleanup?: () => void;
};

type Ctx = {
  // Returns a function to unsubscribe/release
  acquire: (url: string) => SocketSession;

  release: (url: string) => void;
  send: (url: string, msg: unknown) => boolean;
  subscribe: (url: string, params: SubscribeParams<unknown>) => () => void;
};

const WSContext = createContext<Ctx | null>(null);

/**
 * The Provider now acts as a Connection Pool.
 * It doesn't connect to anything until a hook requests it.
 */
export function WebSocketProvider({ retry, heartbeat, debug, children }: WebSocketProviderProps) {
  // Registry of all active connections: URL -> Session
  const sessionsRef = useRef<Map<string, SocketSession>>(new Map());

  // Default Options Memos
  const defaultRetry = useMemo<Required<RetryPolicy>>(
    () => ({
      maxRetries: retry?.maxRetries ?? Number.POSITIVE_INFINITY,
      minDelayMs: retry?.minDelayMs ?? 500,
      maxDelayMs: retry?.maxDelayMs ?? 10_000,
      factor: retry?.factor ?? 1.8,
    }),
    [retry]
  );

  const defaultHeartbeat = useMemo<Required<HeartbeatOptions>>(
    () => ({
      intervalMs: heartbeat?.intervalMs ?? 25_000,
      pingPayload: heartbeat?.pingPayload ?? { kind: "ping" },
    }),
    [heartbeat]
  );

  const log = useCallback(
    (url: string, ...args: unknown[]) => {
      if (debug) {
        console.info(`[WS][${url}]`, ...args);
      }
    },
    [debug]
  );

  // --- Session Management Logic ---

  const createSession = useCallback(
    (
      url: string,
      options: {
        retry: Required<RetryPolicy>;
        heartbeat: Required<HeartbeatOptions>;
        debug: boolean;
      }
    ) => {
      let retries = 0;
      let heartbeatTimer: number | null = null;
      let isConnecting = false;
      let forcedClose = false;

      const session: SocketSession = {
        url,
        ws: null,
        status: "idle",
        error: null,
        queue: [],
        subscribers: new Set(),
        statusListeners: new Set(),
      };

      const notifyStatus = (s: WSStatus, e: Event | Error | null) => {
        session.status = s;
        session.error = e;
        session.statusListeners.forEach((cb) => cb(s, e));
      };

      const calcDelay = (attempt: number) =>
        Math.min(
          options.retry.maxDelayMs,
          Math.round(options.retry.minDelayMs * Math.pow(options.retry.factor, attempt))
        );

      const flushQueue = () => {
        if (!session.ws || session.ws.readyState !== WebSocket.OPEN) {
          return;
        }
        while (session.queue.length) {
          const msg = session.queue.shift();
          try {
            session.ws.send(JSON.stringify(msg));
          } catch {
            if (msg) {
              session.queue.unshift(msg);
            }
            break;
          }
        }
      };

      const startHeartbeat = () => {
        if (heartbeatTimer) {
          clearInterval(heartbeatTimer);
        }
        heartbeatTimer = window.setInterval(() => {
          if (session.ws?.readyState === WebSocket.OPEN) {
            session.ws.send(
              JSON.stringify({ ...options.heartbeat.pingPayload, data: { ts: Date.now() } })
            );
          }
        }, options.heartbeat.intervalMs);
      };

      const stopHeartbeat = () => {
        if (heartbeatTimer) {
          clearInterval(heartbeatTimer);
          heartbeatTimer = null;
        }
      };

      const connect = () => {
        if (forcedClose || isConnecting) {
          return;
        }
        if (
          session.ws &&
          (session.ws.readyState === WebSocket.OPEN ||
            session.ws.readyState === WebSocket.CONNECTING)
        ) {
          return;
        }

        isConnecting = true;
        notifyStatus("connecting", null);

        try {
          const ws = new WebSocket(url);
          session.ws = ws;

          ws.onopen = () => {
            log(url, "open");
            isConnecting = false;
            retries = 0;
            notifyStatus("open", null);
            flushQueue();
            startHeartbeat();

            session.subscribers.forEach((sub) => {
              try {
                sub.onConnect?.();
              } catch {}
            });
          };

          ws.onmessage = (ev) => {
            try {
              const raw = typeof ev.data === "string" ? ev.data : String(ev.data);
              const parsed = JSON.parse(raw);
              session.subscribers.forEach((sub) => {
                try {
                  sub.onMessage?.(parsed);
                } catch {}
              });
            } catch {}
          };

          ws.onerror = (ev) => {
            log(url, "error", ev);
            notifyStatus("error", ev);
          };

          ws.onclose = (ev) => {
            if (forcedClose) {
              return;
            } // Intentional close

            log(url, "close", ev.code);
            stopHeartbeat();
            isConnecting = false;
            notifyStatus("closed", null);

            if (retries < options.retry.maxRetries) {
              const attempt = retries++;
              const delay = calcDelay(attempt);
              log(url, `reconnect in ${delay}ms`);
              setTimeout(connect, delay);
            }
          };
        } catch (e) {
          notifyStatus("error", e as Error);
          isConnecting = false;
          const attempt = retries++;
          setTimeout(connect, calcDelay(attempt));
        }
      };

      // Initial connect
      connect();

      // Attach cleanup function to the session object
      session.cleanup = () => {
        forcedClose = true;
        stopHeartbeat();
        if (session.ws) {
          session.ws.close();
          session.ws = null;
        }
      };

      return session;
    },
    [log]
  ); // log is stable

  // --- Context Methods ---

  const acquire = useCallback(
    (url: string) => {
      let session = sessionsRef.current.get(url);
      if (!session) {
        session = createSession(url, {
          retry: defaultRetry,
          heartbeat: defaultHeartbeat,
          debug: !!debug,
        });
        sessionsRef.current.set(url, session);
      }
      return session;
    },
    [createSession, defaultRetry, defaultHeartbeat, debug]
  );

  const release = useCallback((url: string) => {
    // Optional: Reference counting could go here.
    // For now, we keep sockets open even if hooks unmount to prevent thrashing,
    // unless you explicitly want to close them.
  }, []);

  const send = useCallback((url: string, msg: unknown) => {
    const session = sessionsRef.current.get(url);
    if (!session) {
      return false;
    }

    if (session.ws && session.ws.readyState === WebSocket.OPEN) {
      try {
        session.ws.send(JSON.stringify(msg));
        return true;
      } catch {}
    }
    session.queue.push(msg);
    return false;
  }, []);

  const subscribe = useCallback((url: string, params: SubscribeParams<unknown>) => {
    const session = sessionsRef.current.get(url);
    if (!session) {
      return () => {};
    }

    session.subscribers.add(params);
    return () => {
      session.subscribers.delete(params);
    };
  }, []);

  useEffect(() => {
    const sessions = sessionsRef.current;
    return () => {
      sessions.forEach((s) => s.cleanup?.());
      sessions.clear();
    };
  }, []);

  const value = useMemo<Ctx>(
    () => ({ acquire, release, send, subscribe }),
    [acquire, release, send, subscribe]
  );

  return <WSContext.Provider value={value}>{children}</WSContext.Provider>;
}

/**
 * Hook to interact with a specific WebSocket URL.
 * @param urlFactory - A string URL or an async function that returns the URL.
 */
export function useWebSocket<In = unknown, Out = unknown>(
  urlFactory: string | (() => Promise<string> | string)
) {
  const ctx = useContext(WSContext);
  if (!ctx) {
    throw new Error("useWebSocket must be used within <WebSocketProvider>");
  }

  const [url, setUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<WSStatus>("idle");
  const [error, setError] = useState<Event | Error | null>(null);

  // 1. Resolve the URL (handle async factories)
  useEffect(() => {
    let active = true;
    const resolve = async () => {
      try {
        const result =
          typeof urlFactory === "function"
            ? await (urlFactory as () => Promise<string> | string)()
            : urlFactory;
        if (active) {
          setUrl(result);
        }
      } catch (e) {
        console.error("Failed to resolve WebSocket URL", e);
      }
    };
    resolve();
    return () => {
      active = false;
    };
  }, [urlFactory]);

  // 2. Manage the connection once URL is resolved
  useEffect(() => {
    if (!url) {
      return;
    }

    // A. Connect/Acquire session
    const session = ctx.acquire(url);

    // B. Sync local state with session state immediately
    setStatus(session.status);
    setError(session.error);

    // C. Subscribe to state changes (Connecting/Open/Closed)
    const onStatusChange = (s: WSStatus, e: Event | Error | null) => {
      setStatus(s);
      setError(e);
    };
    session.statusListeners.add(onStatusChange);

    // D. Cleanup
    return () => {
      session.statusListeners.delete(onStatusChange);
      ctx.release(url);
    };
  }, [url, ctx]);

  const send = useCallback(
    (msg: Out) => {
      if (!url) {
        return false;
      }
      return ctx.send(url, msg);
    },
    [ctx, url]
  );

  const subscribe = useCallback(
    (params: SubscribeParams<In>) => {
      if (!url) {
        return () => {};
      }
      return ctx.subscribe(url, params as SubscribeParams<unknown>);
    },
    [ctx, url]
  );

  return { status, error, send, subscribe };
}
