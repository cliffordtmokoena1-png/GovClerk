import hubspot from "@/crm/hubspot";

export const config = {
  runtime: "edge",
};

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();

  if (!isValidEmail(email)) {
    return new Response(JSON.stringify({ error: "Invalid email" }), { status: 400 });
  }

  try {
    await hubspot.createContact({ email, lead_source: "exit_intent_popup" });
  } catch (err) {
    console.error("[exit-intent-lead] HubSpot createContact failed", err);
    return new Response(JSON.stringify({ error: "Failed to save lead" }), { status: 500 });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
