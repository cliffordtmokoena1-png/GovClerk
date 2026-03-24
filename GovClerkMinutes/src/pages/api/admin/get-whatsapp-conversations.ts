import { getAuth } from "@clerk/nextjs/server";
import { connect } from "@planetscale/database";
import { NextRequest } from "next/server";
import { Conversation, SortOption } from "@/admin/whatsapp/types";
import { deserializeFilters } from "@/admin/whatsapp/filter/filters";
import { assertString } from "@/utils/assert";
import withErrorReporting from "@/error/withErrorReporting";
import {
  buildConversationsFor,
  buildSqlParts,
  countTotalFiltered,
  encodeCursor,
  fetchKeysetBatch,
  isMissingTableError,
} from "@/admin/whatsapp/query";

export const config = {
  runtime: "edge",
};

async function handler(req: NextRequest) {
  const { userId: adminUserId, sessionClaims } = getAuth(req);
  if (!adminUserId || !sessionClaims?.metadata?.role || sessionClaims.metadata.role !== "admin") {
    return new Response(null, { status: 401 });
  }

  try {
    const body = await req.json();
    const limit = Math.max(1, Math.min(Number(body.limit ?? 30), 200));
    const rawCursor: string | undefined = body.cursor;
    const sortOption: SortOption = (body.sortOption as SortOption) ?? "recent-desc";

    const serializedFilters = assertString(body.filters);
    const filters = deserializeFilters(serializedFilters);

    const startDateFilter = filters.find((f) => f.type === "startDate")?.value as Date | undefined;
    const endDateFilter = filters.find((f) => f.type === "endDate")?.value as Date | undefined;
    const needsFollowupFilter = filters.find((f) => f.type === "needsFollowup")?.value === true;
    const minutesDueFilter = filters.find((f) => f.type === "minutesDue")?.value as Date | undefined;
    const recurringDueOnFilter = filters.find((f) => f.type === "recurringDueOn")?.value as
      | Date
      | undefined;
    const phoneFilter = filters.find((f) => f.type === "phone")?.value as string | undefined;
    const conversationIdFilter = filters.find((f) => f.type === "conversationId")?.value as
      | string
      | undefined;
    const messageTextFilter = filters.find((f) => f.type === "messageText")?.value as
      | string
      | undefined;
    const messageCountFilter = filters.find((f) => f.type === "messageCount")?.value as
      | { op: "<" | "<=" | "==" | ">=" | ">"; count: number }
      | undefined;
    const unrepliedToFilter = filters.find((f) => f.type === "unrepliedTo")?.value === true;

    const sqlParts = buildSqlParts({
      startDate: startDateFilter,
      endDate: endDateFilter,
      needsFollowup: needsFollowupFilter,
      minutesDueDate: minutesDueFilter,
      recurringDueOn: recurringDueOnFilter,
      phone: phoneFilter,
      conversationId: conversationIdFilter,
      messageText: messageTextFilter,
      messageCount: messageCountFilter,
      unrepliedTo: unrepliedToFilter,
    });

    const conn = connect({
      host: process.env.PLANETSCALE_DB_HOST,
      username: process.env.PLANETSCALE_DB_USERNAME,
      password: process.env.PLANETSCALE_DB_PASSWORD,
    });

    // ---- SCAN LOOP ----
    const SCAN_BATCH = limit * 2;
    let scanCursor = rawCursor;
    const accepted: Conversation[] = [];
    let nextCursor: string | null = null;
    let exhausted = false;

    while (accepted.length < limit && !exhausted) {
      const keyset = await fetchKeysetBatch(conn, sqlParts, scanCursor, SCAN_BATCH, sortOption);
      if (keyset.length === 0) {
        exhausted = true;
        break;
      }

      const conversationIds = keyset.map((k) => k.conversation_id);
      const { conversations } = await buildConversationsFor(conn, adminUserId, conversationIds);
      const convoById = new Map(conversations.map((c) => [c.conversationId, c]));

      for (let i = 0; i < keyset.length && accepted.length < limit; i++) {
        const item = keyset[i];
        const convo = convoById.get(item.conversation_id);
        scanCursor = encodeCursor(item.sort_ts, item.conversation_id);
        if (!convo) {
          continue;
        }
        accepted.push(convo);
      }

      if (accepted.length >= limit) {
        nextCursor = scanCursor!;
        break;
      }

      if (keyset.length < SCAN_BATCH) {
        exhausted = true;
        break;
      }

      const last = keyset[keyset.length - 1];
      scanCursor = encodeCursor(last.sort_ts, last.conversation_id);
    }

    if (!nextCursor) {
      nextCursor = exhausted ? null : (scanCursor ?? null);
    }

    const conversations = accepted.slice(0, limit);
    const total = await countTotalFiltered(conn, sqlParts);

    return new Response(JSON.stringify({ conversations, nextCursor, limit, total }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[admin/get-whatsapp-conversations] Handler error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    // If the table doesn't exist yet (errno 1146), return an empty result set instead of 500
    if (isMissingTableError(error)) {
      console.warn("[admin/get-whatsapp-conversations] WhatsApp table(s) not yet created — returning empty result");
      return new Response(JSON.stringify({ conversations: [], nextCursor: null, limit: 30, total: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export default withErrorReporting(handler);
