/**
 * Migration 002: Add email_domain column to gc_portal_settings.
 *
 * Allows domain-based portal lookup so that users can be auto-routed
 * to their organisation's portal based on their email domain.
 */

import type { Migration } from "./index";

export const migration002: Migration = {
  id: "002",
  name: "Add email_domain to gc_portal_settings",
  sql: `
ALTER TABLE gc_portal_settings
  ADD COLUMN IF NOT EXISTS email_domain VARCHAR(255) DEFAULT NULL
  COMMENT 'Optional email domain for domain-based portal lookup';
  `.trim(),
};