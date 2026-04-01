-- =============================================================================
-- Production Schema Migration: Fix missing tables and columns
-- Apply this script to the PlanetScale production database before removing the
-- graceful-fallback guards added in the corresponding code change.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. gc_customers: Add PayStack columns
--    Resolves: "Unknown column 'paystack_customer_code' in 'field list'"
--              on /agendas and /api/get-customer-details
--
--    Run each ALTER TABLE separately. If a column already exists, MySQL will
--    raise a "Duplicate column name" error which you can safely ignore.
-- ---------------------------------------------------------------------------
ALTER TABLE gc_customers
  ADD COLUMN paystack_customer_code     VARCHAR(255) DEFAULT NULL;

ALTER TABLE gc_customers
  ADD COLUMN paystack_subscription_code VARCHAR(255) DEFAULT NULL;

ALTER TABLE gc_customers
  ADD COLUMN paystack_plan_code         VARCHAR(255) DEFAULT NULL;

-- ---------------------------------------------------------------------------
-- 2. gc_segments: Add is_user_visible column
--    Resolves: "Unknown column 'is_user_visible' in 'field list'"
--              on /api/label-speaker
--
--    Safe to re-run: MySQL raises "Duplicate column name" if already present.
-- ---------------------------------------------------------------------------
ALTER TABLE gc_segments
  ADD COLUMN is_user_visible TINYINT(1) NOT NULL DEFAULT 1;

-- ---------------------------------------------------------------------------
-- 3. minutes_step_state: Create table if it does not exist
--    Resolves: "Table 'govclerkminutes.minutes_step_state' doesn't exist"
--              on /api/get-minutes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS minutes_step_state (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  transcript_id BIGINT UNSIGNED NOT NULL,
  user_id       VARCHAR(255)    DEFAULT NULL,
  org_id        VARCHAR(255)    DEFAULT NULL,
  step          VARCHAR(100)    NOT NULL,
  status        VARCHAR(50)     NOT NULL DEFAULT 'NotStarted',
  error         TEXT            DEFAULT NULL,
  created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_mss_transcript_user_step (transcript_id, user_id, step),
  INDEX idx_mss_transcript_org_step  (transcript_id, org_id, step)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 4. gc_settings: Create table if it does not exist
--    Resolves: "Table 'govclerkminutes.gc_settings' doesn't exist"
--              on /api/get-settings
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gc_settings (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id       VARCHAR(255)    NOT NULL,
  setting_key   VARCHAR(255)    NOT NULL,
  setting_value TEXT            DEFAULT NULL,
  created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_gc_settings_user_key (user_id, setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 5. gc_push_subscriptions: Create table if it does not exist
--    Resolves: "Table 'govclerkminutes.gc_push_subscriptions' doesn't exist"
--              on web push subscribe/unsubscribe and sendPushToAdmins calls
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gc_push_subscriptions (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id         VARCHAR(255)    NOT NULL,
  device_id       VARCHAR(255)    NOT NULL,
  endpoint        TEXT            NOT NULL,
  p256dh          VARCHAR(255)    DEFAULT NULL,
  auth            VARCHAR(255)    DEFAULT NULL,
  expiration_time BIGINT          DEFAULT NULL,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_gc_push_subscriptions_user_device (user_id, device_id),
  INDEX idx_gc_push_subscriptions_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 6. gc_templating: Create table if it does not exist
--    Resolves: "Table 'govclerkminutes.gc_templating' doesn't exist"
--              on /api/templates
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gc_templating (
  template_id   VARCHAR(255)    NOT NULL,
  user_id       VARCHAR(255)    DEFAULT NULL,
  org_id        VARCHAR(255)    DEFAULT NULL,
  name          VARCHAR(500)    NOT NULL,
  description   TEXT            DEFAULT NULL,
  category      VARCHAR(100)    NOT NULL DEFAULT 'general',
  content       LONGTEXT        NOT NULL,
  preview       TEXT            DEFAULT NULL,
  use_case      TEXT            DEFAULT NULL,
  advantages    TEXT            DEFAULT NULL,
  is_default    TINYINT(1)      NOT NULL DEFAULT 0,
  created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (template_id),
  INDEX idx_gc_templating_user  (user_id),
  INDEX idx_gc_templating_org   (org_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- N. gc_settings: Add missing updated_at column
--    Resolves: "Unknown column 'updated_at' in 'field list'" (errno 1054)
--              on /api/set-settings and /api/templates/delete
--
--    The code references updated_at in ON DUPLICATE KEY UPDATE clauses but the
--    column was not present in the production table. Running this migration
--    restores the column so timestamps are tracked.
--    Safe to re-run: MySQL raises "Duplicate column name" if already present.
-- ---------------------------------------------------------------------------
ALTER TABLE gc_settings
  ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP;
