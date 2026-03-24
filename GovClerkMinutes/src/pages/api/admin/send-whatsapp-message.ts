import { getAuth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import whatsapp from "@/admin/whatsapp/api";
import { assertSource, normalizeWhatsappId } from "@/admin/whatsapp/utils";
import { assertString } from "@/utils/assert";
import withErrorReporting from "@/error/withErrorReporting";

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
    const whatsappId = assertString(body.whatsappId);
    const text = assertString(body.text);
    const businessWhatsappId = assertString(body.businessWhatsappId);
    const source = assertSource(body.source);
    const callPermissionRequest = Boolean(body.callPermissionRequest);

    const normalized = normalizeWhatsappId(whatsappId);

    if (source === "whatsapp") {
      await whatsapp.sendMessage({
        type: callPermissionRequest ? "call_permission_request" : "text",
        adminUserId,
        businessWhatsappId,
        to: normalized,
        body: text,
      });
    } else {
      console.error("Unsupported source for sending WhatsApp message:", source);
    }

    return new Response(null, { status: 200 });
  } catch (error) {
    console.error("[admin/send-whatsapp-message] Handler error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export default withErrorReporting(handler);
