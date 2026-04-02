/**
 * Migration 003: Add TikTok Live support to gc_portal_stream_config.
 *
 * Adds tiktok_live_url column. The schema.ts ENUM already includes 'tiktok'
 * so only the column addition is needed here.
 */

import type { Migration } from "./index";

export const migration003: Migration = {
  id: "003",
  name: "Add TikTok live stream support",
  sql: `
ALTER TABLE gc_portal_stream_config
  ADD COLUMN IF NOT EXISTS tiktok_live_url VARCHAR(500) DEFAULT NULL
  COMMENT 'TikTok Live URL';
  `.trim(),
};