/**
 * Migration 004: Add base_version and new_version columns to the changes table.
 *
 * These columns track the revision history for minutes edits, allowing the
 * save-minutes API to determine the next version number for each change.
 */

import type { Migration } from "./index";

export const migration004: Migration = {
  id: "004",
  name: "Add base_version and new_version to changes table",
  sql: `
ALTER TABLE changes
  ADD COLUMN IF NOT EXISTS base_version INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS new_version  INT NOT NULL DEFAULT 1;
  `.trim(),
};
