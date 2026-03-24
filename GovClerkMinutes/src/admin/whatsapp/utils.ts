import { Conversation, SortOption } from "@/admin/whatsapp/types";
import type {
  ScheduleWhatsappPayloadBase,
  ScheduleWhatsappRequestPayload,
  Source,
} from "@/admin/whatsapp/types";

/**
 * Produce a normalized conversation ID for two WhatsApp IDs (numbers as strings).
 * Sorts lexicographically so order of participants doesn't matter.
 * Format: conv_<id1>_<id2>
 */
export function makeConversationId(a: string, b: string): string {
  const [id1, id2] = [a, b].sort();
  return `conv_${id1}_${id2}`;
}

export function sortConversations(
  conversations: Conversation[],
  sortOption: SortOption
): Conversation[] {
  return [...conversations].sort((a, b) => {
    const aStart = new Date(a.messages?.[0]?.timestamp || a.startedAt);
    const bStart = new Date(b.messages?.[0]?.timestamp || b.startedAt);
    const aLast = new Date(a.messages?.[a.messages.length - 1]?.timestamp || a.startedAt);
    const bLast = new Date(b.messages?.[b.messages.length - 1]?.timestamp || b.startedAt);

    switch (sortOption) {
      case "start-asc":
        return aStart.getTime() - bStart.getTime();
      case "start-desc":
        return bStart.getTime() - aStart.getTime();
      case "recent-asc":
        return aLast.getTime() - bLast.getTime();
      case "recent-desc":
      default:
        return bLast.getTime() - aLast.getTime();
    }
  });
}

// Utility functions for scheduler components
// Extract variable placeholders from a template body.
// Supports both named placeholders {{name}} and positional placeholders {{1}}.
// Legacy behavior returned a string[] of names; we keep that as the default (named only).
// For richer use-cases, use extractVariableDetails which returns both named and positional.
export function extractVariables(body: string): string[] {
  const { named } = extractVariableDetails(body);
  return named;
}

export interface VariableExtraction {
  named: string[]; // unique named placeholders (non-numeric)
  positional: string[]; // ordered list of positional indexes encountered as strings ("1","2",...)
}

export function extractVariableDetails(body: string): VariableExtraction {
  // Match things inside double curly braces; allow digits or word chars plus underscores.
  const regex = /{{\s*([A-Za-z0-9_]+)\s*}}/g;
  const matches = [...body.matchAll(regex)].map((m) => m[1]);
  const namedSet = new Set<string>();
  const positionalSet = new Set<string>();
  for (const token of matches) {
    if (/^\d+$/.test(token)) {
      positionalSet.add(token);
    } else {
      namedSet.add(token);
    }
  }
  // Sort positional numerically to preserve ascending order (Cloud API expects sequence alignment)
  const positional = [...positionalSet].sort((a, b) => Number(a) - Number(b));
  return { named: [...namedSet], positional };
}

export function normalizeWhatsappId(phoneNumber: string): string {
  return phoneNumber.replace(/^\+/, "").replace(/[^0-9]/g, "");
}

export async function scheduleWhatsapp(params: ScheduleWhatsappRequestPayload): Promise<void> {
  const shared: ScheduleWhatsappPayloadBase = {
    sendAt: params.sendAt,
    whatsappId: normalizeWhatsappId(params.whatsappId),
    businessWhatsappId: normalizeWhatsappId(params.businessWhatsappId),
    makeHubspotTask: params.makeHubspotTask,
    cancelOnReply: params.cancelOnReply,
    mode: params.mode,
    source: params.source,
  };

  const payload: ScheduleWhatsappRequestPayload =
    params.mode === "template"
      ? {
          ...shared,
          mode: "template",
          templateName: params.templateName,
          templateBody: params.templateBody,
          templateVariables: JSON.stringify(params.templateVariables ?? {}),
          language: params.language,
        }
      : {
          ...shared,
          mode: "freeform",
          text: params.text,
        };

  const res = await fetch("/api/admin/schedule-whatsapp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to schedule message: ${res.status} ${err}`);
  }
}

// Conversation activity status helper
export type ConversationActiveStatus =
  | { status: "inactive" }
  | { status: "active"; lastInboundMsg: Date };

/**
 * Determine whether a conversation is active.
 * Active window = 24h after the most recent inbound message.
 */
export function getConversationActiveStatus(
  conversation: Conversation | undefined | null
): ConversationActiveStatus {
  if (!conversation || !conversation.messages || conversation.messages.length === 0) {
    return { status: "inactive" };
  }

  // Find most recent inbound message
  for (let i = conversation.messages.length - 1; i >= 0; i--) {
    const m = conversation.messages[i];
    if (m.direction === "inbound") {
      const t = new Date(m.timestamp);
      if (!Number.isNaN(t.getTime())) {
        const expiresAt = t.getTime() + 24 * 60 * 60 * 1000;
        if (expiresAt > Date.now()) {
          return { status: "active", lastInboundMsg: t };
        }
      }
      break;
    }
  }
  return { status: "inactive" };
}

export function assertSource(source: string): Source {
  if (source === "wati" || source === "whatsapp") {
    return source;
  }
  throw new Error(`Invalid source: ${source}`);
}
