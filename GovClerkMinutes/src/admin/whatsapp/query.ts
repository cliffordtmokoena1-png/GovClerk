import { Connection } from "@planetscale/database";
import { Conversation, MessageType, SortOption } from "@/admin/whatsapp/types";
import { convertDateForMysql, convertIsoTimestampFromMysql } from "@/utils/date";
import { assertSource } from "./utils";

/**
 * Returns true if the error indicates a missing MySQL/PlanetScale table (errno 1146).
 * This happens when the gc_whatsapps / gc_scheduled_whatsapps tables haven't been
 * created in PlanetScale yet.
 */
export function isMissingTableError(error: unknown): boolean {
  if (error == null) return false;
  // Check for a numeric errno property (PlanetScale/MySQL client may expose this)
  if (typeof (error as any).errno === "number" && (error as any).errno === 1146) return true;
  // Check for MySQL error code string (e.g. ER_NO_SUCH_TABLE)
  if (typeof (error as any).code === "string" && (error as any).code === "ER_NO_SUCH_TABLE")
    return true;
  // Fall back to message substring matching
  const msg = error instanceof Error ? error.message : String(error);
  return msg.includes("doesn't exist") || msg.includes("1146") || msg.includes("ER_NO_SUCH_TABLE");
}

type WhatsappRow = {
  id: number;
  created_at: string;
  operator_email: string | null;
  sender: string | null;
  whatsapp_id: string;
  business_whatsapp_id: string | null;
  conversation_id: string;
  type: string;
  text: string | null;
  direction: "inbound" | "outbound";
  source: string | null;
  message_id: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  error: string | null;
  user_id: string | null;
  first_name: string | null;
  email: string | null;
  minutes_freq: string | null;
  minutes_due: string | null;
  last_read_at: string | null;
};

type ScheduleRow = {
  whatsapp_id: string;
  created_at: string;
  template_id: string;
  variables: Record<string, any> | null;
  send_at: string;
  is_sent: number;
  sender_user_id: string;
  cancel_on_reply: number;
};

type SortPlan = {
  aggExpr: string;
  alias: string;
  orderDir: "ASC" | "DESC";
  cursorComp: (hasHaving: boolean) => string;
  tiebreakDir: "ASC" | "DESC";
};

export function encodeCursor(sortIso: string, conversationId: string): string {
  return `${encodeURIComponent(sortIso)}__${encodeURIComponent(conversationId)}`;
}

export function decodeCursor(cursor: string): { sortIso: string; conversationId: string } | null {
  const parts = cursor.split("__");
  if (parts.length !== 2) {
    return null;
  }
  try {
    return {
      sortIso: decodeURIComponent(parts[0]),
      conversationId: decodeURIComponent(parts[1]),
    };
  } catch {
    return null;
  }
}

/**
 * Build SQL parts for filtering in SQL.
 */
export function buildSqlParts(opts: {
  startDate?: Date;
  endDate?: Date;
  needsFollowup: boolean;
  minutesDueDate?: Date;
  recurringDueOn?: Date;
  phone?: string;
  conversationId?: string;
  messageText?: string;
  messageCount?: { op: "<" | "<=" | "==" | ">=" | ">"; count: number };
  unrepliedTo?: boolean;
}) {
  const {
    startDate,
    endDate,
    needsFollowup,
    minutesDueDate,
    recurringDueOn,
    phone,
    conversationId,
    messageText,
    messageCount,
    unrepliedTo,
  } = opts;

  const joinParts: string[] = [];
  const whereParts: string[] = [];
  const whereParams: any[] = [];
  const havingParts: string[] = [];
  const havingParams: any[] = [];

  const ensureJoinsForLeads = () => {
    // Avoid duplicate JOIN lines
    const hasJoinContacts = joinParts.some((j) => j.includes("gc_whatsapp_contacts c"));
    const hasJoinLeads = joinParts.some((j) => j.includes("gc_leads l"));
    if (!hasJoinContacts) {
      joinParts.push("LEFT JOIN gc_whatsapp_contacts c ON w.whatsapp_id = c.whatsapp_id");
    }
    if (!hasJoinLeads) {
      joinParts.push("INNER JOIN gc_leads l ON l.user_id = c.user_id");
    }
  };

  if (startDate) {
    whereParts.push("w.created_at >= ?");
    whereParams.push(convertDateForMysql(startDate));
  }

  if (endDate) {
    whereParts.push("w.created_at <= ?");
    whereParams.push(convertDateForMysql(endDate));
  }

  if (minutesDueDate) {
    ensureJoinsForLeads();
    whereParts.push("DATE(l.minutes_due) = DATE(?)");
    whereParams.push(convertDateForMysql(minutesDueDate));
  }

  if (recurringDueOn) {
    ensureJoinsForLeads();
    const d = convertDateForMysql(recurringDueOn);
    // Helper booleans via SQL expressions
    // last-day-of-month checks for selected date (?) and anchor date (l.minutes_due)
    const lastDayMatch = `(
      DAY(DATE(?)) = DAY(LAST_DAY(DATE(?)))
      AND DAY(DATE(l.minutes_due)) = DAY(LAST_DAY(DATE(l.minutes_due)))
    )`;
    const sameDayOfMonth = "DAY(DATE(?)) = DAY(DATE(l.minutes_due))";
    const monthlyDayMatch = `(${sameDayOfMonth} OR ${lastDayMatch})`;

    // Build OR-ed clauses per frequency
    const weekly = `(
      l.minutes_freq = 'weekly'
      AND DATEDIFF(DATE(?), DATE(l.minutes_due)) >= 0
      AND MOD(DATEDIFF(DATE(?), DATE(l.minutes_due)), 7) = 0
    )`;
    // NOTE: it's labeled 'bimonthly' from the UI but this means once every 2 weeks.
    const biweekly = `(
      l.minutes_freq = 'bimonthly'
      AND DATEDIFF(DATE(?), DATE(l.minutes_due)) >= 0
      AND MOD(DATEDIFF(DATE(?), DATE(l.minutes_due)), 14) = 0
    )`;
    const monthly = `(
      l.minutes_freq = 'monthly'
      AND TIMESTAMPDIFF(MONTH, DATE(l.minutes_due), DATE(?)) >= 0
      AND ${monthlyDayMatch}
    )`;
    const quarterly = `(
      l.minutes_freq = 'quarterly'
      AND TIMESTAMPDIFF(MONTH, DATE(l.minutes_due), DATE(?)) >= 0
      AND MOD(TIMESTAMPDIFF(MONTH, DATE(l.minutes_due), DATE(?)), 3) = 0
      AND ${monthlyDayMatch}
    )`;
    const biyearly = `(
      l.minutes_freq = 'biyearly'
      AND TIMESTAMPDIFF(MONTH, DATE(l.minutes_due), DATE(?)) >= 0
      AND MOD(TIMESTAMPDIFF(MONTH, DATE(l.minutes_due), DATE(?)), 6) = 0
      AND ${monthlyDayMatch}
    )`;
    const yearly = `(
      l.minutes_freq = 'yearly'
      AND TIMESTAMPDIFF(MONTH, DATE(l.minutes_due), DATE(?)) >= 0
      AND MOD(TIMESTAMPDIFF(MONTH, DATE(l.minutes_due), DATE(?)), 12) = 0
      AND ${monthlyDayMatch}
    )`;

    whereParts.push(`(
      ${weekly} OR
      ${biweekly} OR
      ${monthly} OR
      ${quarterly} OR
      ${biyearly} OR
      ${yearly}
    )`);

    // Push parameters in the same order as used above
    // lastDayMatch and sameDayOfMonth use (?) multiple times. We'll supply d for each placeholder.
    // weekly
    whereParams.push(d, d);
    // biweekly
    whereParams.push(d, d);
    // monthly
    whereParams.push(d, d, d, d);
    // quarterly
    whereParams.push(d, d, d, d, d);
    // biyearly
    whereParams.push(d, d, d, d, d);
    // yearly
    whereParams.push(d, d, d, d, d);
  }

  // Exact match on whatsapp_id after normalizing input (strip leading '+' and spaces). DB values have no leading '+'.
  if (phone && phone.trim().length > 0) {
    const normalized = phone.trim().replace(/\s+/g, "").replace(/^\+/, "");
    whereParts.push("w.whatsapp_id = ?");
    whereParams.push(normalized);
  }

  // Exact match on conversation_id
  if (conversationId && conversationId.trim().length > 0) {
    whereParts.push("w.conversation_id = ?");
    whereParams.push(conversationId.trim());
  }

  if (messageText && messageText.trim().length > 0) {
    const esc = escapeForLike(messageText.trim());
    whereParts.push(
      `EXISTS (
        SELECT 1 FROM gc_whatsapps w2
        WHERE w2.conversation_id = w.conversation_id
          AND w2.text IS NOT NULL
          AND w2.text LIKE ?
      )`
    );
    whereParams.push(`%${esc}%`);
  }

  if (needsFollowup) {
    whereParts.push(
      `NOT EXISTS (
        SELECT 1
        FROM gc_scheduled_whatsapps s
        WHERE s.whatsapp_id = w.whatsapp_id
          AND s.send_at > ?
      )`
    );
    whereParams.push(convertDateForMysql(new Date()));

    const cutoff = new Date(Date.now() - 12 * 60 * 60 * 1000);
    havingParts.push("MAX(w.created_at) <= ?");
    havingParams.push(convertDateForMysql(cutoff));
  }

  // Filter by number of messages in the conversation
  if (messageCount && Number.isFinite(messageCount.count)) {
    const n = Math.max(0, Math.floor(Number(messageCount.count)));
    const op = messageCount.op;
    const cmp = op === "==" ? "=" : op; // map to SQL operator
    havingParts.push(`COUNT(*) ${cmp} ?`);
    havingParams.push(n);
  }

  // Awaiting reply: only show conversations whose latest message is inbound
  if (unrepliedTo) {
    havingParts.push(
      `(
        SELECT w4.direction FROM gc_whatsapps w4
        WHERE w4.conversation_id = w.conversation_id
        ORDER BY w4.created_at DESC
        LIMIT 1
      ) = 'inbound'`
    );
  }

  const joinClause = joinParts.length ? `\n${joinParts.join("\n")}\n` : "";
  const whereClause = whereParts.length ? `\nWHERE ${whereParts.join(" AND ")}\n` : "";
  const havingClause = havingParts.length ? `\nHAVING ${havingParts.join(" AND ")}\n` : "";

  return { joinClause, whereClause, whereParams, havingClause, havingParams };
}

// Escape % and _ by prefixing with backslash. The ESCAPE clause is not used, but MySQL treats \\ as the default escape.
function escapeForLike(input: string): string {
  return input.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/**
 * Map sort mode to SQL aggregate/order/cursor semantics.
 */
function planSort(sortOption: SortOption): SortPlan {
  switch (sortOption) {
    case "recent-asc":
      return {
        aggExpr: "MAX(w.created_at)",
        alias: "sort_ts",
        orderDir: "ASC",
        // For ASC: fetch rows where (sort_ts > ?) OR (sort_ts = ? AND id > ?)
        cursorComp: (hasHaving: boolean) =>
          (hasHaving ? " AND " : " HAVING ") +
          "(sort_ts > ? OR (sort_ts = ? AND w.conversation_id > ?))",
        tiebreakDir: "ASC" as const,
      };
    case "start-desc":
      return {
        aggExpr: "MIN(w.created_at)",
        alias: "sort_ts",
        orderDir: "DESC",
        cursorComp: (hasHaving: boolean) =>
          (hasHaving ? " AND " : " HAVING ") +
          "(sort_ts < ? OR (sort_ts = ? AND w.conversation_id < ?))",
        tiebreakDir: "DESC" as const,
      };
    case "start-asc":
      return {
        aggExpr: "MIN(w.created_at)",
        alias: "sort_ts",
        orderDir: "ASC",
        cursorComp: (hasHaving: boolean) =>
          (hasHaving ? " AND " : " HAVING ") +
          "(sort_ts > ? OR (sort_ts = ? AND w.conversation_id > ?))",
        tiebreakDir: "ASC" as const,
      };
    case "recent-desc":
    default:
      return {
        aggExpr: "MAX(w.created_at)",
        alias: "sort_ts",
        orderDir: "DESC",
        cursorComp: (hasHaving: boolean) =>
          (hasHaving ? " AND " : " HAVING ") +
          "(sort_ts < ? OR (sort_ts = ? AND w.conversation_id < ?))",
        tiebreakDir: "DESC" as const,
      };
  }
}

export async function fetchKeysetBatch(
  conn: Connection,
  sqlParts: {
    joinClause: string;
    whereClause: string;
    whereParams: any[];
    havingClause: string; // may be empty
    havingParams: any[];
  },
  cursor: string | undefined,
  batchSize: number,
  sortOption: SortOption
): Promise<Array<{ conversation_id: string; sort_ts: string }>> {
  const sortPlan = planSort(sortOption);

  const params: any[] = [...sqlParts.whereParams, ...sqlParts.havingParams];

  let cursorHaving = "";
  if (cursor) {
    const decoded = decodeCursor(cursor);
    if (decoded) {
      const cursorDate = new Date(decoded.sortIso);
      cursorHaving = sortPlan.cursorComp(!!sqlParts.havingClause);
      params.push(
        convertDateForMysql(cursorDate),
        convertDateForMysql(cursorDate),
        decoded.conversationId
      );
    }
  }

  params.push(batchSize);

  try {
    const rows = await conn
      .transaction(async (tx) =>
        tx.execute<{ conversation_id: string; sort_ts: string }>(
          `
          SELECT
            w.conversation_id,
            ${sortPlan.aggExpr} AS sort_ts
          FROM gc_whatsapps w
          ${sqlParts.joinClause}
          ${sqlParts.whereClause}
          GROUP BY w.conversation_id
          ${sqlParts.havingClause}${cursorHaving}
          ORDER BY sort_ts ${sortPlan.orderDir}, w.conversation_id ${sortPlan.tiebreakDir}
          LIMIT ?;
          `,
          params
        )
      )
      .then((res) =>
        res.rows.map((r) => ({
          conversation_id: r.conversation_id,
          sort_ts: convertIsoTimestampFromMysql(r.sort_ts),
        }))
      );

    return rows;
  } catch (err) {
    if (isMissingTableError(err)) {
      console.warn("[fetchKeysetBatch] WhatsApp table(s) not yet created — returning empty batch");
      return [];
    }
    throw err;
  }
}

export async function buildConversationsFor(
  conn: Connection,
  userId: string,
  conversationIds: string[]
): Promise<{ conversations: Conversation[] }> {
  if (conversationIds.length === 0) {
    return { conversations: [] as Conversation[] };
  }

  const placeholders = conversationIds.map(() => "?").join(",");
  let rows: WhatsappRow[];
  try {
    rows = await conn
      .transaction(async (tx) =>
        tx.execute<WhatsappRow>(
          `
          SELECT
            w.id,
            w.created_at,
            w.operator_email,
            w.sender,
            w.whatsapp_id,
            w.business_whatsapp_id,
            w.conversation_id,
            w.type,
            w.text,
            w.direction,
            w.source,
            w.message_id,
            w.sent_at,
            w.delivered_at,
            w.read_at,
            w.error,
            c.user_id,
            l.first_name,
            l.email,
            l.minutes_freq,
            l.minutes_due,
            r.last_read_at
          FROM gc_whatsapps w
          LEFT JOIN gc_whatsapp_contacts c ON w.whatsapp_id = c.whatsapp_id
          LEFT JOIN gc_leads l ON c.user_id = l.user_id
          LEFT JOIN gc_whatsapp_reads r ON r.user_id = ? AND w.conversation_id = r.conversation_id
          WHERE w.conversation_id IN (${placeholders})
          ORDER BY w.conversation_id, w.created_at;
          `,
          [userId, ...conversationIds]
        )
      )
      .then((result) =>
        result.rows.map((r) => ({
          ...r,
          created_at: convertIsoTimestampFromMysql(r.created_at),
          last_read_at: r.last_read_at ? convertIsoTimestampFromMysql(r.last_read_at) : null,
          sent_at: r.sent_at ? convertIsoTimestampFromMysql(r.sent_at) : null,
          delivered_at: r.delivered_at ? convertIsoTimestampFromMysql(r.delivered_at) : null,
          read_at: r.read_at ? convertIsoTimestampFromMysql(r.read_at) : null,
        }))
      );
  } catch (err) {
    if (isMissingTableError(err)) {
      console.warn(
        "[buildConversationsFor] WhatsApp table(s) not yet created — returning empty conversations"
      );
      return { conversations: [] };
    }
    throw err;
  }

  const convos: Record<string, WhatsappRow[]> = {};
  for (const row of rows) {
    (convos[row.conversation_id] ??= []).push(row);
  }

  const whatsappIds = Array.from(new Set(rows.map((r) => r.whatsapp_id)));
  let schedules: Record<string, ScheduleRow[]> = {};
  if (whatsappIds.length) {
    const schedPH = whatsappIds.map(() => "?").join(",");
    let scheduleRows: ScheduleRow[];
    try {
      scheduleRows = await conn
        .transaction(async (tx) =>
          tx.execute<ScheduleRow>(
            `
            SELECT
              whatsapp_id,
              created_at,
              template_id,
              variables,
              send_at,
              is_sent,
              sender_user_id,
              cancel_on_reply
            FROM gc_scheduled_whatsapps
            WHERE whatsapp_id IN (${schedPH})
            ORDER BY created_at;
            `,
            whatsappIds
          )
        )
        .then((res) =>
          res.rows.map((r) => ({
            ...r,
            created_at: convertIsoTimestampFromMysql(r.created_at),
            send_at: convertIsoTimestampFromMysql(r.send_at),
          }))
        );
    } catch (err) {
      if (isMissingTableError(err)) {
        console.warn(
          "[buildConversationsFor] gc_scheduled_whatsapps table not yet created — skipping schedules"
        );
        scheduleRows = [];
      } else {
        throw err;
      }
    }

    for (const s of scheduleRows) {
      (schedules[s.whatsapp_id] ??= []).push(s);
    }
  }

  const conversations: Conversation[] = Object.entries(convos).map(([conversationId, convo]) => {
    const whatsappId = convo[0]?.whatsapp_id;
    const businessWhatsappId = (convo[0]?.business_whatsapp_id ?? "").replace(/^\+/, "");
    const leadName = convo[0]?.first_name ?? convo[0]?.sender ?? "Unknown";
    const email = convo[0]?.email ?? undefined;
    const userId = convo[0]?.user_id ?? undefined;
    const frequency = convo[0]?.minutes_freq ?? undefined;
    const dueDate = convo[0]?.minutes_due ?? undefined;
    const startedAt = convo[0]?.created_at;
    const lastReadAt = convo[0]?.last_read_at ?? undefined;
    const source = assertSource(convo[0]?.source ?? "wati");

    return {
      conversationId,
      whatsappId,
      businessWhatsappId,
      leadName,
      email,
      userId,
      frequency,
      dueDate,
      lastReadAt,
      source,
      startedAt,
      messages: convo.map((msg) => ({
        timestamp: msg.created_at,
        sender:
          msg.direction === "inbound"
            ? (msg.sender ?? "Unknown")
            : (msg.sender ?? msg.operator_email ?? "Unknown"),
        text: msg.text ?? "",
        type: msg.type as MessageType,
        direction: msg.direction,
        messageId: msg.message_id ?? undefined,
        sentAt: msg.sent_at ?? undefined,
        deliveredAt: msg.delivered_at ?? undefined,
        readAt: msg.read_at ?? undefined,
        error: msg.error ?? undefined,
      })),
      scheduleRequests: (schedules[whatsappId] ?? []).map((s) => ({
        createdAt: s.created_at,
        templateId: s.template_id,
        variables: s.variables,
        sendAt: s.send_at,
        isSent: s.is_sent,
        senderUserId: s.sender_user_id,
        cancelOnReply: s.cancel_on_reply,
      })),
    };
  });

  return { conversations };
}

export async function countTotalFiltered(
  conn: Connection,
  sqlParts: {
    joinClause: string;
    whereClause: string;
    whereParams: any[];
    havingClause: string;
    havingParams: any[];
  }
) {
  const params: any[] = [...sqlParts.whereParams, ...sqlParts.havingParams];
  try {
    const row = await conn
      .transaction(async (tx) =>
        tx.execute<{ total: number }>(
          `
          SELECT COUNT(*) AS total
          FROM (
            SELECT w.conversation_id
            FROM gc_whatsapps w
            ${sqlParts.joinClause}
            ${sqlParts.whereClause}
            GROUP BY w.conversation_id
            ${sqlParts.havingClause}
          ) t;
          `,
          params
        )
      )
      .then((r) => r.rows[0]);

    return Number(row?.total ?? 0);
  } catch (err) {
    if (isMissingTableError(err)) {
      console.warn("[countTotalFiltered] WhatsApp table(s) not yet created — returning 0");
      return 0;
    }
    throw err;
  }
}
