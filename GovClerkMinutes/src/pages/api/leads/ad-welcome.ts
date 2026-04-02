import { NextRequest } from "next/server";
import withErrorReporting from "@/error/withErrorReporting";
import { sendLeadWelcome } from "@/ai-agent/sendLeadWelcome";

export const config = {
  runtime: "edge",
};

interface AdWelcomeBody {
  phone: string;
  firstName: string;
  leadSource?: string;
  adCampaign?: string;
}

async function handler(req: NextRequest): Promise<Response> {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Require a dedicated LEADS_API_KEY to authenticate callers.
  // This keeps the leads endpoint's auth independent from other webhook secrets.
  const apiKey = process.env.LEADS_API_KEY;
  if (!apiKey) {
    console.error("[leads/ad-welcome] LEADS_API_KEY environment variable is not configured");
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader || authHeader !== `Bearer ${apiKey}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: AdWelcomeBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const phone = body.phone?.trim();
  const firstName = body.firstName?.trim();
  const adCampaign = body.adCampaign?.trim();

  if (!phone) {
    return new Response(JSON.stringify({ error: "phone is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!firstName) {
    return new Response(JSON.stringify({ error: "firstName is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  console.log(
    `[leads/ad-welcome] Initiating ad welcome for phone=${phone}, firstName=${firstName}, adCampaign=${adCampaign ?? "n/a"}`
  );

  // Fire-and-forget: do not await so the response returns immediately
  void sendLeadWelcome({
    phone,
    firstName,
    templateName: "samantha_ad_welcome",
    templateBody:
      "Hi {{first_name}}! 👋 I'm Samantha from GovClerk Minutes.\n\nThanks for your interest in automating your meeting minutes! I'd love to learn a bit more about your needs so I can point you to the right solution.\n\nCan I ask you a few quick questions? It'll only take a minute! 🕐",
    parameters: { first_name: firstName },
    leadSource: "paid_ad",
  });

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

export default withErrorReporting(handler);
