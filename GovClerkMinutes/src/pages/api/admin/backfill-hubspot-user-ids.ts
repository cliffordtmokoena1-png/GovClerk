import { getAuth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import withErrorReporting from "@/error/withErrorReporting";
import { connect } from "@planetscale/database";
import hubspot from "@/crm/hubspot";

export const config = {
  runtime: "edge",
};

type LeadRow = {
  user_id: string;
  email: string | null;
  first_name: string | null;
  phone: string | null;
  minutes_freq: string | null;
  minutes_due: string | null;
  instantly_id: string | null;
  occupation: string | null;
  organization_name: string | null;
};

async function handler(req: NextRequest) {
  const { userId: adminUserId, sessionClaims } = getAuth(req);
  if (!adminUserId || !sessionClaims?.metadata?.role || sessionClaims.metadata.role !== "admin") {
    return new Response(null, { status: 401 });
  }

  if (req.method !== "POST") {
    return new Response(null, { status: 405 });
  }

  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  // Fetch ALL leads that have a user_id (email optional — phone may be enough)
  const result = await conn.execute(
    `SELECT user_id, email, first_name, phone, minutes_freq, minutes_due, instantly_id, occupation, organization_name
     FROM gc_leads
     WHERE user_id IS NOT NULL
     ORDER BY user_id ASC`
  );

  const leads = result.rows as LeadRow[];

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const lead of leads) {
    // Skip if no email AND no phone — nothing to identify the contact in HubSpot
    if (!lead.email && !lead.phone) {
      skipped++;
      continue;
    }

    try {
      // Try to find existing contact in HubSpot — check by email first, then phone
      let contact = null;

      if (lead.email) {
        contact = await hubspot.getContact({
          filter: { propertyName: "email", value: lead.email },
          returnedProperties: ["email", "user_id"],
        });
      }

      if (!contact && lead.phone) {
        contact = await hubspot.getContact({
          filter: { propertyName: "phone", value: lead.phone },
          returnedProperties: ["phone", "user_id"],
        });
      }

      if (!contact) {
        // CREATE new contact in HubSpot
        await hubspot.createContact({
          userId: lead.user_id,
          email: lead.email ?? undefined,
          firstName: lead.first_name ?? undefined,
          phone: lead.phone ?? undefined,
          minutesFreq: lead.minutes_freq ?? undefined,
          minutesDue: lead.minutes_due ?? undefined,
          instantlyId: lead.instantly_id ?? undefined,
          occupation: lead.occupation ?? undefined,
          organizationName: lead.organization_name ?? undefined,
          lead_source: "db_migration",
        });
        created++;
      } else if (contact.properties.user_id === lead.user_id) {
        // Already correct — skip
        skipped++;
      } else {
        // UPDATE existing contact's user_id
        const filterProp = lead.email ? "email" : "phone";
        const filterVal = (lead.email ?? lead.phone)!;
        await hubspot.updateContact({
          filter: { propertyName: filterProp, value: filterVal },
          properties: { userId: lead.user_id },
        });
        updated++;
      }
    } catch (err) {
      failed++;
      const identifier = lead.email ?? lead.phone ?? lead.user_id;
      errors.push(`${identifier}: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Rate limit: 300ms between HubSpot API calls
    await new Promise((r) => setTimeout(r, 300));
  }

  return new Response(
    JSON.stringify({
      total: leads.length,
      created,
      updated,
      skipped,
      failed,
      errors: errors.slice(0, 20),
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}

export default withErrorReporting(handler);