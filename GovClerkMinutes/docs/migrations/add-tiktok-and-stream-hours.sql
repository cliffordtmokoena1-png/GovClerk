-- Migration: Add TikTok Live support and streaming hours tracking
-- Run this on PlanetScale before deploying the corresponding code changes.

-- ---------------------------------------------------------------------------
-- 1. gc_portal_stream_config: Add tiktok_live_url column and update ENUM
--    Safe to re-run: MySQL raises "Duplicate column name" if already present.
-- ---------------------------------------------------------------------------
ALTER TABLE gc_portal_stream_config
  ADD COLUMN tiktok_live_url VARCHAR(500) COMMENT 'TikTok Live URL' AFTER facebook_live_url;

ALTER TABLE gc_portal_stream_config
  MODIFY COLUMN preferred_platform ENUM('youtube','zoom','google_meet','facebook','rtmp','custom','tiktok') DEFAULT 'youtube';

-- ---------------------------------------------------------------------------
-- 2. gc_broadcasts: Add went_live_at column for streaming hours tracking
--    Safe to re-run: MySQL raises "Duplicate column name" if already present.
-- ---------------------------------------------------------------------------
ALTER TABLE gc_broadcasts
  ADD COLUMN went_live_at DATETIME COMMENT 'Timestamp when broadcast transitioned to live' AFTER started_at;
