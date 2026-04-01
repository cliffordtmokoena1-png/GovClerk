/**
 * SQL migrations for Phase 1 Portal Auth.
 * Run these against the PlanetScale database.
 */

export const PORTAL_AUTH_SCHEMA = `
-- Portal users: staff/council members who sign in with their work email
CREATE TABLE IF NOT EXISTS gc_portal_users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  org_id VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  role ENUM('admin', 'member', 'readonly') NOT NULL DEFAULT 'member',
  email_domain VARCHAR(255) NOT NULL COMMENT 'e.g. capetown.gov.za — must match org domain',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  last_login_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_org_email (org_id, email),
  KEY idx_org_id (org_id),
  KEY idx_email (email)
);

-- Shared org passwords: a single password shared among all council members of an org
CREATE TABLE IF NOT EXISTS gc_portal_shared_passwords (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  org_id VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  label VARCHAR(255) NOT NULL DEFAULT 'Council Access' COMMENT 'e.g. "Full Council", "Public Gallery"',
  expires_at DATETIME COMMENT 'NULL means never expires',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by_user_id INT UNSIGNED COMMENT 'gc_portal_users.id of the admin who created it',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_org_id (org_id)
);

-- Portal sessions: JWT alternative stored server-side for revocation support
CREATE TABLE IF NOT EXISTS gc_portal_sessions (
  id VARCHAR(64) PRIMARY KEY COMMENT 'random session token (hex)',
  org_id VARCHAR(255) NOT NULL,
  portal_user_id INT UNSIGNED COMMENT 'NULL for shared-password sessions',
  shared_password_id INT UNSIGNED COMMENT 'set when authenticated via shared password',
  email VARCHAR(255) COMMENT 'email used to log in (NULL for shared sessions)',
  auth_type ENUM('email', 'shared') NOT NULL DEFAULT 'email',
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_org_id (org_id),
  KEY idx_expires (expires_at)
);

-- Org domain allow-list: which email domains are allowed for this org's portal
CREATE TABLE IF NOT EXISTS gc_portal_org_domains (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  org_id VARCHAR(255) NOT NULL,
  domain VARCHAR(255) NOT NULL COMMENT 'e.g. capetown.gov.za',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_org_domain (org_id, domain),
  KEY idx_org_id (org_id)
);
`;
