import { getAuth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import withErrorReporting from "@/error/withErrorReporting";
import { processMessage } from "@/ai-agent/conversation";
import { assertString } from "@/utils/assert";
import type { AgentMessage, AgentChannel } from "@/ai-agent/types";

export const config = {
  runtime: "edge",
};

async function handler(req: NextRequest) {
  const { userId, sessionClaims } = getAuth(req);
  if (!userId || sessionClaims?.metadata?.role !== "admin") {
    return new Response(null, { status: 401 });
  }

  if (req.method !== "POST") {
    return new Response(null, { status: 405 });
  }

  try {
    const body = await req.json();
    const message = assertString(body.message);
    // Validated and passed through in the response so callers can correlate the reply
    const senderWhatsappId = assertString(body.senderWhatsappId);
    const businessWhatsappId = assertString(body.businessWhatsappId);
    const channel: AgentChannel = body.channel === "facebook" ? "facebook" : "whatsapp";
    const conversationHistory: AgentMessage[] = Array.isArray(body.conversationHistory)
      ? body.conversationHistory
      : [];

    const response = await processMessage(message, conversationHistory);

    return new Response(
      JSON.stringify({
        ...response,
        senderWhatsappId,
        businessWhatsappId,
        channel,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[ai-agent/chat] Handler error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export default withErrorReporting(handler);
