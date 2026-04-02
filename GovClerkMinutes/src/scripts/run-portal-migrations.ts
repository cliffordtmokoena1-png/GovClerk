#!/usr/bin/env tsx
/**
 * Portal Database Migration Runner
 *
 * Connects to PlanetScale and applies any pending migrations from
 * src/db/migrations/index.ts in sequential order.
 *
 * Usage:
 *   npm run db:migrate            # apply pending migrations
 *   npm run db:migrate:dry        # preview only (no changes)
 *   npm run db:migrate:status     # show which are applied/pending
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

const STATEMENT_SEPARATOR = ";";

function getConnection() {
  const host = process.env.PLANETSCALE_DB_HOST;
  const username = process.env.PLANETSCALE_DB_USERNAME;
  const password = process.env.PLANETSCALE_DB_PASSWORD;

  if (!host || !username || !password) {
    console.error(
      "Missing required environment variables: PLANETSCALE_DB_HOST, PLANETSCALE_DB_USERNAME, PLANETSCALE_DB_PASSWORD"
    );
    process.exit(1);
  }

  return connect({ host, username, password });
}

async function ensureMigrationsTable(conn: ReturnType<typeof connect>): Promise<void> {
  await conn.execute(
    "CREATE TABLE IF NOT EXISTS gc_portal_migrations (" +
    "  id VARCHAR(20) NOT NULL PRIMARY KEY," +
    "  name VARCHAR(255) NOT NULL," +
    "  applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP," +
    "  KEY idx_applied (applied_at)" +
    ")"
  );
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
    .split(STATEMENT_SEPARATOR)
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
  console.log("GovClerk Portal Migration Runner");
  console.log("================================");
  console.log("");

  const conn = getConnection();

  await ensureMigrationsTable(conn);

  const applied = await getAppliedMigrations(conn);
  const pending = MIGRATIONS.filter((m) => !applied.has(m.id));

  if (STATUS_ONLY) {
    console.log("Migration Status:");
    console.log("");
    for (const m of MIGRATIONS) {
      const status = applied.has(m.id) ? "[APPLIED]" : "[PENDING]";
      console.log("  " + m.id + " - " + m.name + "  " + status);
    }
    console.log("");
    console.log("  Total: " + MIGRATIONS.length + " | Applied: " + applied.size + " | Pending: " + pending.length);
    return;
  }

  if (pending.length === 0) {
    console.log("All migrations are up to date. Nothing to apply.");
    console.log("");
    return;
  }

  console.log("Found " + pending.length + " pending migration(s):");
  console.log("");
  for (const m of pending) {
    console.log("  [PENDING] " + m.id + " - " + m.name);
  }
  console.log("");

  if (DRY_RUN) {
    console.log("DRY RUN - showing SQL that would be executed:");
    console.log("");
    for (const m of pending) {
      console.log("--- " + m.id + ": " + m.name + " ---");
      console.log(m.sql);
      console.log("");
    }
    console.log("No changes were made (dry run).");
    return;
  }

  for (const m of pending) {
    process.stdout.write("  Applying " + m.id + " - " + m.name + "...");
    try {
      await applyMigration(conn, m.id, m.name, m.sql);
      console.log(" OK");
    } catch (err: any) {
      console.log(" FAILED");
      console.error("");
      console.error("  Error applying migration " + m.id + ":");
      console.error("  " + (err.message || err));
      console.error("");
      console.error("  Aborting. Fix the issue and re-run.");
      process.exit(1);
    }
  }

  console.log("");
  console.log("Successfully applied " + pending.length + " migration(s).");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});