import { Command } from "commander";
import { connect } from "@planetscale/database";
import dotenv from "dotenv";
import hubspot from "@/crm/hubspot";

dotenv.config({ path: ".env" });

type ContactRow = {
  whatsapp_id: string | null;
  whatsapp_name: string | null;
  user_id: string | null;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  organization_name: string | null;
  minutes_freq: string | null;
  minutes_due: string | null;
  instantly_id: string | null;
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Prefix a digit-only whatsapp_id with '+' to produce a dialable phone string */
function prefixPhoneWithPlus(whatsappId: string): string {
  return `+${whatsappId}`;
}

/** Return the best display name for a contact */
function displayName(row: ContactRow): string {
  if (row.first_name || row.last_name) {
    return [row.first_name, row.last_name].filter(Boolean).join(" ");
  }
  return row.whatsapp_name ?? row.email ?? row.phone ?? "Unknown";
}

/** Return the phone number to use for this contact (prefer gc_leads.phone) */
function resolvePhone(row: ContactRow): string | undefined {
  if (row.phone) return row.phone;
  if (row.whatsapp_id) return prefixPhoneWithPlus(row.whatsapp_id);
  return undefined;
}

async function fetchContacts(): Promise<ContactRow[]> {
  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  // Contacts that have a WhatsApp record (joined with leads)
  const whatsappQuery = `
    SELECT
      c.whatsapp_id,
      c.name  AS whatsapp_name,
      c.user_id,
      l.email,
      l.first_name,
      l.last_name,
      l.phone,
      l.organization_name,
      l.minutes_freq,
      l.minutes_due,
      l.instantly_id
    FROM gc_whatsapp_contacts c
    LEFT JOIN gc_leads l ON c.user_id = l.user_id
    ORDER BY c.whatsapp_id
  `;

  // Standalone leads that have no WhatsApp contact entry
  const standaloneLeadsQuery = `
    SELECT
      NULL           AS whatsapp_id,
      NULL           AS whatsapp_name,
      l.user_id,
      l.email,
      l.first_name,
      l.last_name,
      l.phone,
      l.organization_name,
      l.minutes_freq,
      l.minutes_due,
      l.instantly_id
    FROM gc_leads l
    WHERE l.user_id NOT IN (
      SELECT user_id FROM gc_whatsapp_contacts WHERE user_id IS NOT NULL
    )
    AND (l.email IS NOT NULL OR l.phone IS NOT NULL)
  `;

  const [whatsappRes, standaloneRes] = await Promise.all([
    conn.execute(whatsappQuery),
    conn.execute(standaloneLeadsQuery),
  ]);

  return [...(whatsappRes.rows as ContactRow[]), ...(standaloneRes.rows as ContactRow[])];
}

async function syncContacts({ dryRun }: { dryRun: boolean }): Promise<void> {
  console.log("🔍 Fetching contacts from PlanetScale…");
  const contacts = await fetchContacts();
  console.log(`📋 Found ${contacts.length} total contacts in DB.\n`);

  let created = 0;
  let wouldCreate = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < contacts.length; i++) {
    const row = contacts[i];
    const phone = resolvePhone(row);
    const name = displayName(row);
    const index = `[${i + 1}/${contacts.length}]`;

    // Skip contacts with neither phone nor email — nothing to look up or create
    if (!phone && !row.email) {
      console.log(`${index} ⚠️  Skipping (no phone or email): ${name}`);
      skipped++;
      continue;
    }

    if (dryRun) {
      console.log(`${index} [DRY-RUN] Would sync: ${phone ?? row.email} (${name})`);
      wouldCreate++;
      continue;
    }

    try {
      // --- Deduplication: check by phone first, then email ---
      let exists = false;

      if (phone) {
        const byPhone = await hubspot.getContact({
          filter: { propertyName: "phone", value: phone },
          returnedProperties: ["phone"],
        });
        if (byPhone) {
          exists = true;
        }
      }

      if (!exists && row.email) {
        const byEmail = await hubspot.getContact({
          filter: { propertyName: "email", value: row.email },
          returnedProperties: ["email"],
        });
        if (byEmail) {
          exists = true;
        }
      }

      if (exists) {
        console.log(`${index} ⏭️  Skipped (already in HubSpot): ${phone ?? row.email} (${name})`);
        skipped++;
      } else {
        await hubspot.createContact({
          userId: row.user_id ?? undefined,
          email: row.email ?? undefined,
          // Only use first_name from gc_leads; whatsapp_name is a full display name, not a first name
          firstName: row.first_name ?? undefined,
          phone: phone,
          minutesFreq: row.minutes_freq ?? undefined,
          minutesDue: row.minutes_due ?? undefined,
          instantlyId: row.instantly_id ?? undefined,
          lead_source: "db_migration",
        });
        console.log(`${index} ✅ Created contact ${phone ?? row.email} (${name})`);
        created++;
      }
    } catch (err) {
      console.error(`${index} ❌ Failed for ${phone ?? row.email} (${name}):`, err);
      failed++;
    }

    // Rate-limit: ~250 ms between actual HubSpot API calls
    await delay(250);
  }

  console.log("\n--- Summary ---");
  console.log(`Total found  : ${contacts.length}`);
  if (dryRun) {
    console.log(`Would create : ${wouldCreate}`);
    console.log(`Would skip   : ${skipped}`);
  } else {
    console.log(`Created      : ${created}`);
    console.log(`Skipped      : ${skipped}`);
    console.log(`Failed       : ${failed}`);
  }
}

const program = new Command()
  .name("sync-contacts-to-hubspot")
  .description("Sync all contacts from PlanetScale DB into HubSpot CRM")
  .option("--dry-run", "Print what would be synced without calling HubSpot", false)
  .action(async (opts: { dryRun: boolean }) => {
    try {
      if (opts.dryRun) {
        console.log("🚧 DRY-RUN mode enabled — no contacts will be created.\n");
      }
      await syncContacts({ dryRun: opts.dryRun });
      console.log("\n🎉 Done.");
    } catch (err) {
      console.error("❌ Sync failed:", err);
      process.exit(1);
    }
  });

program.parseAsync(process.argv).catch((err) => {
  console.error("❌ CLI crashed:", err);
  process.exit(1);
});
