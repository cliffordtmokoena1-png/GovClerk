import type { WhatsappWebhook } from "@/admin/whatsapp/types";
// Outgoing messages we send to the server
export type OutgoingMessage =
  | { kind: "ping"; data?: { ts?: number } }
  | { kind: "pong"; data?: { ts?: number } };

// Incoming messages we receive from the server
export type IncomingMessage =
  | { kind: "ping"; data?: { ts?: number } }
  | { kind: "pong"; data?: { ts?: number } }
  | { kind: "error"; data: { message: string } }
  | { kind: "new_whatsapp" }
  | {
      kind: "call";
      data: { kind: string; value: WhatsappWebhook.CallsValue };
    };

// Type guard to validate inbound messages at runtime
export function isIncomingMessage(msg: unknown): msg is IncomingMessage {
  if (!msg || typeof msg !== "object") {
    return false;
  }
  const m = msg as { kind?: unknown; data?: unknown };
  if (typeof m.kind !== "string") {
    return false;
  }
  switch (m.kind) {
    case "ping":
    case "pong": {
      if (m.data === undefined) {
        return true;
      }
      if (typeof m.data !== "object" || m.data === null) {
        return false;
      }
      const d = m.data as { ts?: unknown };
      return d.ts === undefined || typeof d.ts === "number";
    }
    case "error": {
      if (typeof m.data !== "object" || m.data === null) {
        return false;
      }
      const d = m.data as { message?: unknown };
      return typeof d.message === "string";
    }
    case "new_whatsapp":
      return true;
    case "call": {
      if (typeof m.data !== "object" || m.data === null) {
        return false;
      }
      const d = m.data as { kind?: unknown; value?: unknown };
      if (typeof d.kind !== "string" || typeof d.value !== "object" || d.value === null) {
        return false;
      }
      return true;
    }
    default:
      return false;
  }
}
