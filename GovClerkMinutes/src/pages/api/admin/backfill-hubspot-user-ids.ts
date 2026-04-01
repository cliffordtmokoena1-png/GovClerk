import { getAuth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import withErrorReporting from "@/error/withErrorReporting";
import { connect } from "@planetscale/database";
import hubspot from "@/crm/hubspot";

export const config = {
  runtime: "edge",
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

  // Fetch all leads with both user_id and email — no ORDER BY id (column doesn't exist)
  const result = await conn.execute(
    "SELECT user_id, email FROM gc_leads WHERE user_id IS NOT NULL AND email IS NOT NULL ORDER BY user_id ASC"
  );

  const leads = result.rows as { user_id: string; email: string }[];

  let updated = 0;
  let skipped = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const lead of leads) {
    try {
      // Check if contact exists in HubSpot and get current user_id
      const contact = await hubspot.getContact({
        filter: { propertyName: "email", value: lead.email },
        returnedProperties: ["email", "user_id"],
      });

      if (!contact) {
        skipped++;
        continue;
      }

      // Skip if user_id already set correctly
      if (contact.properties.user_id === lead.user_id) {
        skipped++;
        continue;
      }

      // Update the user_id
      await hubspot.updateContact({
        filter: { propertyName: "email", value: lead.email },
        properties: { userId: lead.user_id },
      });

      updated++;
    } catch (err) {
      failed++;
      errors.push(`${lead.email}: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Rate limit: 300ms between calls
    await new Promise((r) => setTimeout(r, 300));
  }

  return new Response(
    JSON.stringify({
      total: leads.length,
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