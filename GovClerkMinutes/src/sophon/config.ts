import { isDev } from "@/utils/dev";

const DEV_SOPHON_URL = "http://localhost:3000";
const PROD_SOPHON_URL = "https://sophon.GovClerkMinutes.com";

function getSophonBaseUrl(): string {
  return isDev() ? DEV_SOPHON_URL : PROD_SOPHON_URL;
}

/**
 * Get the WebSocket URL for connecting to Sophon.
 * Automatically converts http(s) to ws(s).
 */
export function getSophonWsUrl(path: string = ""): string {
  const base = getSophonBaseUrl();
  const wsBase = base.replace(/^http/, "ws");
  return `${wsBase}${path}`;
}

/**
 * Get the HTTP URL for Sophon endpoints.
 */
export function getSophonHttpUrl(path: string = ""): string {
  const base = getSophonBaseUrl();
  return `${base}${path}`;
}

/**
 * Get the HLS stream URL for a given stream key.
 */
export function getHlsStreamUrl(streamKey: string): string {
  return getSophonHttpUrl(`/hls/${streamKey}.m3u8`);
}

/**
 * Get the HLS stream URL using broadcast ID.
 * This is the public endpoint that doesn't expose the stream key.
 */
export function getHlsStreamUrlByBroadcastId(broadcastId: number): string {
  return getSophonHttpUrl(`/hls/broadcast/${broadcastId}.m3u8`);
}

/**
 * Get the RTMP URL for streaming.
 * For local development, this returns rtmp://localhost/live
 */
export function getRtmpUrl(): string {
  const base = getSophonBaseUrl();
  if (base.includes("localhost") || base.includes("127.0.0.1")) {
    return "rtmp://localhost/live";
  }
  // Extract hostname from URL
  const url = new URL(base);
  return `rtmp://${url.hostname}/live`;
}

/**
 * Get the WebSocket URL for transcript streaming.
 */
export function getTranscriptWsUrl(streamKey: string): string {
  return getSophonWsUrl(`/ws/transcript/${streamKey}`);
}

/**
 * Get the WebSocket URL for transcript streaming using broadcast ID.
 * This is the public endpoint that doesn't expose the stream key.
 */
export function getTranscriptWsUrlByBroadcastId(broadcastId: number): string {
  return getSophonWsUrl(`/ws/transcript/broadcast/${broadcastId}`);
}
