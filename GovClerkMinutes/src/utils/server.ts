import { isProd } from "./dev";

const PROD_SERVER_URI = "https://server.GovClerkMinutes.com";
const PROD_SERVER_WEBSOCKET_URI = "wss://server.GovClerkMinutes.com";

export function serverUri(slug: string): string {
  return isProd()
    ? new URL(slug, PROD_SERVER_URI).toString()
    : new URL(slug, "http://127.0.0.1:8000").toString();
}

export function prodServerUri(slug: string): string {
  return new URL(slug, PROD_SERVER_URI).toString();
}

export function websocketUri(slug: string, opts: { forceProd?: boolean } = {}): string {
  return opts.forceProd || isProd()
    ? new URL(slug, PROD_SERVER_WEBSOCKET_URI).toString()
    : new URL(slug, "ws://127.0.0.1:8000").toString();
}
