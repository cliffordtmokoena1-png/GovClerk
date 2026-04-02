import { getAuth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { connect } from "@planetscale/database";
import withErrorReporting from "@/error/withErrorReporting";
import type { AiActivitiesMetrics } from "@/ai-agent/types";

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

    // Calls received: distinct inbound conversations today
    const callsReceivedResult = await conn.execute(
      `SELECT COUNT(DISTINCT conversation_id) AS cnt
       FROM gc_whatsapps
       WHERE DATE(created_at) = ?
         AND direction = 'inbound'`,
      [today]
    );
    const callsReceived = Number(
      (callsReceivedResult.rows[0] as Record<string, unknown>)?.cnt ?? 0
    );

    // Calls made: distinct outbound AI-initiated conversations today
    const callsMadeResult = await conn.execute(
      `SELECT COUNT(DISTINCT conversation_id) AS cnt
       FROM gc_whatsapps
       WHERE DATE(created_at) = ?
         AND direction = 'outbound'
         AND operator_email = 'ai-agent'`,
      [today]
    );
    const callsMade = Number((callsMadeResult.rows[0] as Record<string, unknown>)?.cnt ?? 0);

    // Messages processed: total messages where the AI replied today
    const messagesResult = await conn.execute(
      `SELECT COUNT(*) AS cnt
       FROM gc_whatsapps
       WHERE DATE(created_at) = ?
         AND operator_email = 'ai-agent'`,
      [today]
    );
    const messagesProcessed = Number((messagesResult.rows[0] as Record<string, unknown>)?.cnt ?? 0);

    // Payment plans sent: AI messages containing a payment link today
    const paymentPlansSentResult = await conn.execute(
      `SELECT COUNT(*) AS cnt
       FROM gc_whatsapps
       WHERE DATE(created_at) = ?
         AND operator_email = 'ai-agent'
         AND direction = 'outbound'
         AND (text LIKE '%paystack%' OR text LIKE '%payment link%' OR text LIKE '%payment-success%')`,
      [today]
    );
    const paymentPlansSent = Number(
      (paymentPlansSentResult.rows[0] as Record<string, unknown>)?.cnt ?? 0
    );

    // Paid plans: successful payments with source 'whatsapp_ai_agent' today
    let paidPlans = 0;
    try {
      const paidPlansResult = await conn.execute(
        `SELECT COUNT(*) AS cnt
         FROM payments
         WHERE DATE(created_at) = ?
           AND credit > 0
           AND (action = 'whatsapp_ai_agent' OR action = 'paystack_ai')`,
        [today]
      );
      paidPlans = Number((paidPlansResult.rows[0] as Record<string, unknown>)?.cnt ?? 0);
    } catch (err) {
      // payments table may not have the action column in all environments
      console.warn("[admin/ai-activities] Could not query paid plans (schema may differ):", err);
      paidPlans = 0;
    }

    // Follow-up count: unique conversations needing follow-up
    let followUpCount = 0;
    try {
      const followUpResult = await conn.execute(
        `SELECT COUNT(DISTINCT conversation_id) AS cnt
         FROM gc_whatsapps
         WHERE needs_followup = 1`,
        []
      );
      followUpCount = Number((followUpResult.rows[0] as Record<string, unknown>)?.cnt ?? 0);
    } catch (err) {
      // needs_followup column may not exist in all environments
      console.warn(
        "[admin/ai-activities] Could not query follow-up count (schema may differ):",
        err
      );
      followUpCount = 0;
    }

    const metrics: AiActivitiesMetrics = {
      callsReceived,
      callsMade,
      messagesProcessed,
      paymentPlansSent,
      paidPlans,
      followUpCount,
      date: today,
    };

    return new Response(JSON.stringify(metrics), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[admin/ai-activities] Handler error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export default withErrorReporting(handler);
