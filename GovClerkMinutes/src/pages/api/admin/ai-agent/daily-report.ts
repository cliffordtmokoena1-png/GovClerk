import { getAuth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { connect } from "@planetscale/database";
import withErrorReporting from "@/error/withErrorReporting";
import type { DailyReport } from "@/ai-agent/types";

export const config = {
  runtime: "edge",
};

async function handler(req: NextRequest) {
  const { userId, sessionClaims } = getAuth(req);
  if (!userId || sessionClaims?.metadata?.role !== "admin") {
    return new Response(null, { status: 401 });
  }

  if (req.method !== "GET") {
    return new Response(null, { status: 405 });
  }

  try {
    const conn = connect({
      host: process.env.PLANETSCALE_DB_HOST,
      username: process.env.PLANETSCALE_DB_USERNAME,
      password: process.env.PLANETSCALE_DB_PASSWORD,
    });

    const today = new Date().toISOString().slice(0, 10);

    // Total conversations today
    const totalResult = await conn.execute(
      `SELECT COUNT(DISTINCT conversation_id) AS cnt
       FROM gc_whatsapps
       WHERE DATE(created_at) = ?`,
      [today]
    );
    const totalConversations = Number((totalResult.rows[0] as Record<string, unknown>)?.cnt ?? 0);

    // AI-handled messages today (those with operator_email = 'ai-agent')
    const aiResult = await conn.execute(
      `SELECT COUNT(DISTINCT conversation_id) AS cnt
       FROM gc_whatsapps
       WHERE DATE(created_at) = ?
         AND operator_email = 'ai-agent'`,
      [today]
    );
    const aiHandledCount = Number((aiResult.rows[0] as Record<string, unknown>)?.cnt ?? 0);

    // Escalated conversations today
    const escalatedResult = await conn.execute(
      `SELECT COUNT(*) AS cnt
       FROM gc_whatsapps
       WHERE DATE(created_at) = ?
         AND operator_email = 'ai-agent'
         AND text LIKE '%transferring your conversation%'`,
      [today]
    );
    const escalatedCount = Number((escalatedResult.rows[0] as Record<string, unknown>)?.cnt ?? 0);

    // Inbound messages today
    const inboundResult = await conn.execute(
      `SELECT COUNT(*) AS cnt
       FROM gc_whatsapps
       WHERE DATE(created_at) = ?
         AND direction = 'inbound'`,
      [today]
    );
    const inboundMessages = Number((inboundResult.rows[0] as Record<string, unknown>)?.cnt ?? 0);

    // Outbound messages today
    const outboundResult = await conn.execute(
      `SELECT COUNT(*) AS cnt
       FROM gc_whatsapps
       WHERE DATE(created_at) = ?
         AND direction = 'outbound'`,
      [today]
    );
    const outboundMessages = Number((outboundResult.rows[0] as Record<string, unknown>)?.cnt ?? 0);

    // Scheduled messages for today
    const scheduledResult = await conn.execute(
      `SELECT COUNT(*) AS cnt
       FROM gc_scheduled_whatsapps
       WHERE DATE(send_at) = ?
         AND is_sent = 0`,
      [today]
    );
    const pendingScheduled = Number((scheduledResult.rows[0] as Record<string, unknown>)?.cnt ?? 0);

    const report: DailyReport = {
      date: today,
      sales: [{ metric: "Outbound Messages", value: outboundMessages }],
      followUps: [{ metric: "Pending Scheduled Messages", value: pendingScheduled }],
      scheduledDemos: [],
      totalConversations,
      aiHandledCount,
      escalatedCount,
    };

    return new Response(JSON.stringify(report), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[ai-agent/daily-report] Handler error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export default withErrorReporting(handler);
