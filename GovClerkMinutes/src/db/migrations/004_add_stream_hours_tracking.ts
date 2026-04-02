/**
 * Migration 004: Add stream hours tracking columns to gc_broadcasts.
 *
 * Adds:
 * - stream_started_at: When the broadcast went live (for duration calc)
 * - stream_duration_seconds: Total seconds streamed (updated when broadcast ends)
 *
 * These columns allow the system to:
 * 1. Calculate how long each broadcast streamed
 * 2. Increment gc_portal_subscriptions.stream_hours_used when a broadcast ends
 * 3. Block going live when streaming hours are exhausted
 */

import type { Migration } from "./index";

export const migration004: Migration = {
  id: "004",
  name: "Add stream hours tracking to gc_broadcasts",
  sql: `
ALTER TABLE gc_broadcasts
  ADD COLUMN IF NOT EXISTS stream_started_at DATETIME DEFAULT NULL
  COMMENT 'Timestamp when status changed to live';

ALTER TABLE gc_broadcasts
  ADD COLUMN IF NOT EXISTS stream_duration_seconds INT UNSIGNED DEFAULT NULL
  COMMENT 'Total seconds streamed, set when broadcast ends';
  `.trim(),
};