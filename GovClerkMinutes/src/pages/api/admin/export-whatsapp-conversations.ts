import { getAuth } from "@clerk/nextjs/server";
import { connect } from "@planetscale/database";
import { NextRequest } from "next/server";
import withErrorReporting from "@/error/withErrorReporting";
import { assertString } from "@/utils/assert";
import { Conversation, SortOption } from "@/admin/whatsapp/types";
import { deserializeFilters } from "@/admin/whatsapp/filter/filters";
import {
  buildConversationsFor,
  buildSqlParts,
  encodeCursor,
  fetchKeysetBatch,
} from "@/admin/whatsapp/query";

export const config = {
  runtime: "edge",
};

type ExportBody = {
  filters: string;
  sortOption?: SortOption;
  selectAll: boolean;
  excludedConversationIds?: string[];
  includedConversationIds?: string[];
};

function writeConversation(write: (s: string) => void, convo: Conversation) {
  write(`=== Conversation ${convo.conversationId} ===\n`);
  const items: { ts: string; msg: string }[] = [];

  for (const m of convo.messages) {
    const date = new Date(m.timestamp);
    items.push({
      ts: date.toISOString(),
      msg: `[${date.toLocaleString()}] ${
        m.direction === "inbound" ? (convo.leadName ?? "Lead") : "Operator"
      }: ${m.text.trim()}\n`,
    });
  }

  if (convo.scheduleRequests?.length) {
    for (const s of convo.scheduleRequests) {
      const tsSource = s.sendAt ?? s.createdAt;
      const date = new Date(tsSource);
      items.push({
        ts: date.toISOString(),
        msg: `[${date.toLocaleString()}] Scheduled: template=${s.templateId} sendAt=${s.sendAt} created=${s.createdAt} sent=${s.isSent} cancelOnReply=${s.cancelOnReply}\n`,
      });
    }
  }

  items.sort((a, b) => a.ts.localeCompare(b.ts));

  for (const it of items) {
    write(it.msg);
  }
  write("\n");
}

async function handler(req: NextRequest) {
  const { userId: adminUserId, sessionClaims } = getAuth(req);
  if (!adminUserId || !sessionClaims?.metadata?.role || sessionClaims.metadata.role !== "admin") {
    return new Response(null, { status: 401 });
  }

  let body: ExportBody;
  let sortOption: SortOption;
  let filters: ReturnType<typeof deserializeFilters>;
  let sqlParts: ReturnType<typeof buildSqlParts>;
  let conn: ReturnType<typeof connect>;
  try {
    body = (await req.json()) as ExportBody;
    sortOption = body.sortOption ?? "recent-desc";
    filters = deserializeFilters(assertString(body.filters));
    const startDateFilter = filters.find((f) => f.type === "startDate")?.value as Date | undefined;
    const endDateFilter = filters.find((f) => f.type === "endDate")?.value as Date | undefined;
    const needsFollowup = filters.find((f) => f.type === "needsFollowup")?.value === true;
    const minutesDue = filters.find((f) => f.type === "minutesDue")?.value as Date | undefined;

    sqlParts = buildSqlParts({
      startDate: startDateFilter,
      endDate: endDateFilter,
      needsFollowup,
      minutesDueDate: minutesDue,
    });

    conn = connect({
      host: process.env.PLANETSCALE_DB_HOST,
      username: process.env.PLANETSCALE_DB_USERNAME,
      password: process.env.PLANETSCALE_DB_PASSWORD,
    });
  } catch (error) {
    console.error("[admin/export-whatsapp-conversations] Setup error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const includedSet = new Set(body.includedConversationIds ?? []);
  const excludedSet = new Set(body.excludedConversationIds ?? []);

  // Streaming text response (Edge-friendly)
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      const write = (s: string) => controller.enqueue(encoder.encode(s));
      write("# WhatsApp Export\n");
      write(`# Generated: ${new Date().toISOString()}\n\n`);

      const BATCH = 200;
      let cursor: string | undefined = undefined;
      let exhausted = false;

      const shouldInclude = (id: string) => {
        if (body.selectAll) {
          return !excludedSet.has(id);
        }
        return includedSet.has(id);
      };

      if (!body.selectAll && includedSet.size === 0) {
        write("(No conversations selected)\n");
        controller.close();
        return;
      }

      while (!exhausted) {
        // When selectAll=false, we can short-circuit and fetch only for included IDs in chunks.
        if (!body.selectAll) {
          const wanted = Array.from(includedSet).slice(0, BATCH);
          if (wanted.length === 0) {
            break;
          }

          const { conversations } = await buildConversationsFor(conn, adminUserId, wanted);
          for (const convo of conversations) {
            writeConversation(write, convo);
            includedSet.delete(convo.conversationId);
          }
          continue;
        }

        // selectAll = true → scan across all filtered convos using keyset
        const keyset = await fetchKeysetBatch(conn, sqlParts, cursor, BATCH, sortOption);
        if (keyset.length === 0) {
          exhausted = true;
          break;
        }

        const ids = keyset.map((k) => k.conversation_id).filter(shouldInclude);
        if (ids.length) {
          const { conversations } = await buildConversationsFor(conn, adminUserId, ids);
          for (const convo of conversations) {
            writeConversation(write, convo);
          }
        }

        const last = keyset[keyset.length - 1];
        cursor = encodeCursor(last.sort_ts, last.conversation_id);
      }

      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="whatsapp-export-${Date.now()}.txt"`,
      "Cache-Control": "no-store",
    },
  });
}

export default withErrorReporting(handler);
