import { getAuth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import withErrorReporting from "@/error/withErrorReporting";
import hubspot from "@/crm/hubspot";
import { HUBSPOT_INSTANCE_ID, HUBSPOT_REGION } from "@/crm/hubspot/consts";

export const config = {
  runtime: "edge",
};

// Check hubspot for email, then if not found, check phone
async function getContactId(email?: string, phone?: string): Promise<string | undefined> {
  if (email) {
    const contact = await hubspot.getContact({
      filter: {
        propertyName: "email",
        value: email,
      },
    });
    if (contact && contact.id) {
      return contact.id;
    }
  }

  if (phone) {
    const contact = await hubspot.getContact({
      filter: {
        propertyName: "phone",
        value: phone,
      },
    });
    if (contact && contact.id) {
      return contact.id;
    }
  }

  return undefined;
}

async function handler(req: NextRequest) {
  const { userId: adminUserId, sessionClaims } = getAuth(req);
  if (!adminUserId || !sessionClaims?.metadata?.role || sessionClaims.metadata.role !== "admin") {
    return new Response(null, { status: 401 });
  }

  try {
    const body = await req.json();
    const email = body?.email;
    const phone = body?.phone;
    const contactId = await getContactId(email, phone);

    if (!contactId) {
      return new Response(JSON.stringify({ url: null }), {
        status: 404,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }

    // https://app-na2.hubspot.com/contacts/242974326/record/0-1/286756130548
    const url = `https://${HUBSPOT_REGION}.hubspot.com/contacts/${HUBSPOT_INSTANCE_ID}/record/0-1/${contactId}`;

    return new Response(JSON.stringify({ url }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("[admin/get-hubspot-url] Handler error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export default withErrorReporting(handler);
