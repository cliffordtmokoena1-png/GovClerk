import { isProd } from "./dev";

const PROD_SERVER_URI = process.env.NEXT_PUBLIC_SERVER_URL || "https://server.GovClerkMinutes.com";
const PROD_SERVER_WEBSOCKET_URI =
  process.env.NEXT_PUBLIC_SERVER_WS_URL || "wss://server.GovClerkMinutes.com";

const DEV_SERVER_URI = process.env.SERVER_URI || "http://127.0.0.1:8000";
const DEV_SERVER_WS_URI = process.env.SERVER_WS_URI || "ws://127.0.0.1:8000";

export function serverUri(slug: string): string {
  return isProd()
    ? new URL(slug, PROD_SERVER_URI).toString()
    : new URL(slug, DEV_SERVER_URI).toString();
}

export function prodServerUri(slug: string): string {
  return new URL(slug, PROD_SERVER_URI).toString();
}

export function websocketUri(slug: string, opts: { forceProd?: boolean } = {}): string {
  return opts.forceProd || isProd()
    ? new URL(slug, PROD_SERVER_WEBSOCKET_URI).toString()
    : new URL(slug, DEV_SERVER_WS_URI).toString();
}
