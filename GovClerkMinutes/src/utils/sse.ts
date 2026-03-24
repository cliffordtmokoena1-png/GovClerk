import { SSE, SSEvent as Event } from "sse.js";
import { isDev } from "@/utils/dev";
import { safeCapture } from "@/utils/safePosthog";

export interface SSEOptions {
  headers?: Record<string, string>;
  payload?: string;
  method?: "GET" | "POST";
  onmessage: (event: Event, sse: SSE) => void;
  onopen?: (event: Event, sse: SSE) => void;
  onerror?: (event: Event, sse: SSE) => void;
}

export const openSSE = (url: string, options: SSEOptions): SSE => {
  const {
    headers = { "Content-Type": "application/json" },
    payload = "",
    method = "POST",
    onmessage,
    onopen = (event: Event, sse: SSE) => {
      safeCapture("sse_connection_opened", {
        options,
      });
    },
    onerror = (event: Event, sse: SSE) => {
      console.error("SSE error:", event);
      safeCapture("sse_connection_errored", {
        options,
      });
      sse.close();
    },
  } = options;

  const sse = new SSE(url, { headers, payload, method, debug: isDev() });

  sse.onopen = (event) => onopen(event, sse);
  sse.onmessage = (event) => onmessage(event, sse);
  sse.onerror = (event) => onerror(event, sse);

  return sse;
};
