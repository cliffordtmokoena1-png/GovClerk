-- GovClerk Public Portal — Authentication & Subscription Schema
-- Run against the PlanetScale database (MySQL-compatible).

-- Portal users (separate from GovClerkMinutes/Clerk users)
CREATE TABLE IF NOT EXISTS gc_portal_users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  org_id        VARCHAR(255) NOT NULL,
  email         VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name    VARCHAR(255),
  last_name     VARCHAR(255),
  role          ENUM('member', 'editor', 'admin') NOT NULL DEFAULT 'member',
  email_domain  VARCHAR(255),
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  last_login_at TIMESTAMP NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_email_org (email, org_id),
  INDEX idx_org_id (org_id)
);

-- Email verification codes (6-digit, time-limited)
CREATE TABLE IF NOT EXISTS gc_portal_email_verifications (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  org_id            VARCHAR(255) NOT NULL,
  email             VARCHAR(255) NOT NULL,
  verification_code VARCHAR(10)  NOT NULL,
  is_verified       TINYINT(1)   NOT NULL DEFAULT 0,
  expires_at        TIMESTAMP    NOT NULL,
  created_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_org_email (org_id, email),
  INDEX idx_email (email)
);

-- Allowed email domains per organisation
-- If no rows exist for an org, any organisational email is accepted.
CREATE TABLE IF NOT EXISTS gc_portal_org_domains (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  org_id     VARCHAR(255) NOT NULL,
  domain     VARCHAR(255) NOT NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_org_domain (org_id, domain),
  INDEX idx_org_id (org_id)
);

-- Active portal sessions (cookie-based, stored in DB)
CREATE TABLE IF NOT EXISTS gc_portal_sessions (
  id                 VARCHAR(64)  NOT NULL PRIMARY KEY,
  org_id             VARCHAR(255) NOT NULL,
  portal_user_id     INT          NULL,
  shared_password_id INT          NULL,
  email              VARCHAR(255) NULL,
  auth_type          ENUM('email', 'shared') NOT NULL,
  expires_at         TIMESTAMP    NOT NULL,
  created_at         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_org_id (org_id),
  INDEX idx_expires_at (expires_at)
);

-- Portal subscription / pricing
CREATE TABLE IF NOT EXISTS gc_portal_subscriptions (
  id                            INT AUTO_INCREMENT PRIMARY KEY,
  org_id                        VARCHAR(255)  NOT NULL,
  tier                          ENUM('starter', 'professional', 'enterprise', 'custom') NOT NULL DEFAULT 'starter',
  seats_included                INT           NOT NULL DEFAULT 5,
  seats_used                    INT           NOT NULL DEFAULT 0,
  stream_hours_included         DECIMAL(10,2) NOT NULL DEFAULT 2.00,
  stream_hours_used             DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  monthly_price_zar             DECIMAL(10,2) NOT NULL,
  status                        ENUM('active', 'trial', 'suspended', 'cancelled') NOT NULL DEFAULT 'trial',
  paystack_subscription_code    VARCHAR(255)  NULL,
  paystack_plan_code            VARCHAR(255)  NULL,
  trial_ends_at                 TIMESTAMP     NULL,
  current_period_start          TIMESTAMP     NULL,
  current_period_end            TIMESTAMP     NULL,
  created_at                    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_org (org_id)
);

-- Quote requests for portal pricing
CREATE TABLE IF NOT EXISTS gc_portal_quote_requests (
  id                                    INT AUTO_INCREMENT PRIMARY KEY,
  org_name                              VARCHAR(255) NOT NULL,
  org_type                              ENUM('municipality', 'school_board', 'hoa', 'county', 'state_agency', 'other') NOT NULL DEFAULT 'other',
  contact_name                          VARCHAR(255) NOT NULL,
  contact_email                         VARCHAR(255) NOT NULL,
  contact_phone                         VARCHAR(50)  NULL,
  estimated_seats                       INT          NULL,
  estimated_monthly_meetings            INT          NULL,
  estimated_avg_meeting_duration_hours  DECIMAL(5,2) NULL,
  needs_live_streaming                  TINYINT(1)   NOT NULL DEFAULT 0,
  needs_public_records                  TINYINT(1)   NOT NULL DEFAULT 0,
  needs_document_archival               TINYINT(1)   NOT NULL DEFAULT 0,
  needs_govclerk_minutes                TINYINT(1)   NOT NULL DEFAULT 0,
  additional_notes                      TEXT         NULL,
  selected_plan                         VARCHAR(50)  NULL,
  estimated_streaming_hours             DECIMAL(10,2) NULL,
  website_url                           VARCHAR(500) NULL,
  status                                ENUM('new', 'contacted', 'quoted', 'won', 'lost') NOT NULL DEFAULT 'new',
  quoted_monthly_zar                    DECIMAL(10,2) NULL,
  quoted_tier                           VARCHAR(50)  NULL,
  created_at                            TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                            TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
