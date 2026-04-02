/**
 * Portal Database Migration Registry
 *
 * All migrations are registered here in execution order.
 * The runner script reads this array and applies pending migrations.
 *
 * To add a new migration:
 *   1. Create a new file: NNN_description.ts
 *   2. Export a Migration object with id, name, and sql
 *   3. Import it here and add it to the MIGRATIONS array
 *
 * Rules:
 *   - Migration IDs must be unique and sequential (001, 002, ...)
 *   - Each migration's SQL must be idempotent where possible
 *     (use IF NOT EXISTS, IF EXISTS, etc.)
 *   - Never modify an already-applied migration — create a new one instead
 *   - PlanetScale does not support multi-statement transactions for DDL;
 *     each ALTER TABLE is atomic on its own
 */

export interface Migration {
  /** Unique sequential ID, e.g. "001" */
  id: string;
  /** Human-readable description */
  name: string;
  /** SQL statement(s) to execute. Multiple statements separated by semicolons. */
  sql: string;
}

import { migration001 } from "./001_create_migrations_table";
import { migration002 } from "./002_add_settings_email_domain";
import { migration003 } from "./003_add_tiktok_stream_support";
// import { migration004 } from "./004_add_stream_hours_tracking";

export const MIGRATIONS: Migration[] = [
  migration001,
  migration002,
  migration003,
  // migration004,
];
