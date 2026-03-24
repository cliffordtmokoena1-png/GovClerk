import withErrorReporting from "@/error/withErrorReporting";
import { getAuth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import {
  acceptCall,
  preAcceptCall,
  rejectCall,
  terminateCall,
  connectCall,
} from "@/admin/whatsapp/api/calls";
import { assertString } from "@/utils/assert";

export const config = {
  runtime: "edge",
};

type Action = "connect" | "pre_accept" | "accept" | "reject" | "terminate";

type Body =
  | {
      action: "connect";
      to: string;
      session: { sdp_type: "offer"; sdp: string };
      biz_opaque_callback_data?: string;
      businessWhatsappId: string;
    }
  | {
      action: "pre_accept";
      callId: string;
      session: { sdp_type: "answer"; sdp: string };
      businessWhatsappId: string;
    }
  | {
      action: "accept";
      callId: string;
      session: { sdp_type: "answer"; sdp: string };
      biz_opaque_callback_data?: string;
      businessWhatsappId: string;
    }
  | { action: "reject"; callId: string; businessWhatsappId: string }
  | { action: "terminate"; callId: string; businessWhatsappId: string };

async function handler(req: NextRequest) {
  const { userId, sessionClaims } = getAuth(req);
  if (!userId || sessionClaims?.metadata?.role !== "admin") {
    return new Response("Unauthorized", { status: 401 });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  try {
    switch (body.action as Action) {
      case "connect": {
        const b = body as Extract<Body, { action: "connect" }>;
        const res = await connectCall({
          to: b.to,
          session: b.session,
          bizOpaqueCallbackData: b.biz_opaque_callback_data,
          businessWhatsappId: b.businessWhatsappId,
        });
        console.info("Connect call response:", res.raw);
        return json({ callId: res.callId });
      }
      case "pre_accept": {
        const b = body as Extract<Body, { action: "pre_accept" }>;
        const res = await preAcceptCall({
          callId: b.callId,
          session: b.session,
          businessWhatsappId: b.businessWhatsappId,
        });
        console.info("Pre-accept call response:", res);
        return json(res);
      }
      case "accept": {
        const b = body as Extract<Body, { action: "accept" }>;
        const res = await acceptCall({
          callId: b.callId,
          session: b.session,
          bizOpaqueCallbackData: b.biz_opaque_callback_data,
          businessWhatsappId: b.businessWhatsappId,
        });
        console.info("Accept call response:", res);
        return json(res);
      }
      case "reject": {
        const b = body as Extract<Body, { action: "reject" }>;
        const res = await rejectCall({
          callId: b.callId,
          businessWhatsappId: b.businessWhatsappId,
        });
        console.info("Reject call response:", res);
        return json(res);
      }
      case "terminate": {
        const b = body as Extract<Body, { action: "terminate" }>;
        const res = await terminateCall({
          callId: b.callId,
          businessWhatsappId: b.businessWhatsappId,
        });
        console.info("Terminate call response:", res);
        return json(res);
      }
      default:
        return new Response("Unsupported action", { status: 400 });
    }
  } catch (e: unknown) {
    console.error("Error handling WhatsApp call action:", e);
    const message = e instanceof Error ? e.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

function json(obj: unknown) {
  return new Response(JSON.stringify(obj), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

export default withErrorReporting(handler);
