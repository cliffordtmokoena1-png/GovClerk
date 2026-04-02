#!/usr/bin/env tsx
/**
 * Portal Database Migration Runner
 *
 * Connects to PlanetScale and applies any pending migrations from
 * src/db/migrations/index.ts in sequential order.
 *
 * Usage:
 *   npx tsx src/scripts/run-portal-migrations.ts            # apply pending
 *   npx tsx src/scripts/run-portal-migrations.ts --dry-run   # preview only
 *   npx tsx src/scripts/run-portal-migrations.ts --status     # show status
 *
 * Requires environment variables:
 *   PLANETSCALE_DB_HOST
 *   PLANETSCALE_DB_USERNAME
 *   PLANETSCALE_DB_PASSWORD
 */

import "dotenv/config";
import { connect } from "@planetscale/database";
import { MIGRATIONS } from "../db/migrations/index";

const DRY_RUN = process.argv.includes("--dry-run");
const STATUS_ONLY = process.argv.includes("--status");

function getConnection() {
  const host = process.env.PLANETSCALE_DB_HOST;
  const username = process.env.PLANETSCALE_DB_USERNAME;
  const password = process.env.PLANETSCALE_DB_PASSWORD;

  if (!host || !username || !password) {
    console.error(
      "❌ Missing required environment variables: PLANETSCALE_DB_HOST, PLANETSCALE_DB_USERNAME, PLANETSCALE_DB_PASSWORD"
    );
    process.exit(1);
  }

  return connect({ host, username, password });
}

async function ensureMigrationsTable(conn: ReturnType<typeof connect>): Promise<void> {
  // Migration 001 creates the tracking table itself, but we need to bootstrap
  // it if this is the very first run.
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS gc_portal_migrations (
      id VARCHAR(20) NOT NULL PRIMARY KEY COMMENT 'Migration ID e.g. 001, 002',
      name VARCHAR(255) NOT NULL COMMENT 'Human-readable name',
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_applied (applied_at)
    );
  `);
}

async function getAppliedMigrations(
  conn: ReturnType<typeof connect>
): Promise<Set<string>> {
  const result = await conn.execute("SELECT id FROM gc_portal_migrations ORDER BY id");
  return new Set((result.rows as any[]).map((row) => row.id));
}

async function applyMigration(
  conn: ReturnType<typeof connect>,
  id: string,
  name: string,
  sql: string
): Promise<void> {
  // Split on semicolons to handle multi-statement migrations
  const statements = sql
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    await conn.execute(statement);
  }

  // Record the migration as applied
  await conn.execute(
    "INSERT INTO gc_portal_migrations (id, name) VALUES (?, ?)",
    [id, name]
  );
}

async function main() {
  console.log("🔄 GovClerk Portal Migration Runner\n");

  const conn = getConnection();

  // Ensure the tracking table exists
  await ensureMigrationsTable(conn);

  // Get already-applied migrations
  const applied = await getAppliedMigrations(conn);

  // Determine pending migrations
  const pending = MIGRATIONS.filter((m) => !applied.has(m.id));

  if (STATUS_ONLY) {
    console.log(`📊 Migration Status:\n`);
    for (const m of MIGRATIONS) {
      const status = applied.has(m.id) ? "✅ Applied" : "⏳ Pending";
      console.log(`  ${m.id} — ${m.name}  [${status}]`);
    }
    console.log(`\n  Total: ${MIGRATIONS.length} | Applied: ${applied.size} | Pending: ${pending.length}`);
    return;
  }

  if (pending.length === 0) {
    console.log("✅ All migrations are up to date. Nothing to apply.\n");
    return;
  }

  console.log(`Found ${pending.length} pending migration(s):\n`);
  for (const m of pending) {
    console.log(`  ⏳ ${m.id} — ${m.name}`);
  }
  console.log("");

  if (DRY_RUN) {
    console.log("🔍 DRY RUN — showing SQL that would be executed:\n");
    for (const m of pending) {
      console.log(`--- ${m.id}: ${m.name} ---`);
      console.log(m.sql);
      console.log("");
    }
    console.log("No changes were made (dry run).");
    return;
  }

  // Apply each pending migration
  for (const m of pending) {
    process.stdout.write(`  Applying ${m.id} — ${m.name}...`);
    try {
      await applyMigration(conn, m.id, m.name, m.sql);
      console.log(" ✅");
    } catch (err: any) {
      console.log(" ❌");
      console.error(`\n  Error applying migration ${m.id}:`);
      console.error(`  ${err.message || err}\n`);
      console.error("  Aborting. Fix the issue and re-run.");
      process.exit(1);
    }
  }

  console.log(`\n✅ Successfully applied ${pending.length} migration(s).`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
