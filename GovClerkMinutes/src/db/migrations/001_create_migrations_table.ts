/**
 * Migration 001: Create the gc_portal_migrations tracking table.
 *
 * This is the foundation migration — it creates the table that the runner
 * uses to record which migrations have already been applied.
 */

import type { Migration } from "./index";

export const migration001: Migration = {
  id: "001",
  name: "Create migrations tracking table",
  sql: `
CREATE TABLE IF NOT EXISTS gc_portal_migrations (
  id VARCHAR(20) NOT NULL PRIMARY KEY COMMENT 'Migration ID e.g. 001, 002',
  name VARCHAR(255) NOT NULL COMMENT 'Human-readable name',
  applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_applied (applied_at)
);
  `.trim(),
};