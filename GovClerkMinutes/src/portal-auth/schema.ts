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

export const PORTAL_LIVE_SCHEMA = `
-- Stream configuration per org
CREATE TABLE IF NOT EXISTS gc_portal_stream_config (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  org_id VARCHAR(255) NOT NULL,
  youtube_channel_id VARCHAR(100) COMMENT 'YouTube channel ID for embed',
  youtube_live_url VARCHAR(500) COMMENT 'Direct YouTube Live URL',
  zoom_join_url VARCHAR(500) COMMENT 'Zoom webinar/meeting join URL',
  zoom_webinar_id VARCHAR(100),
  google_meet_url VARCHAR(500),
  facebook_page_id VARCHAR(100),
  facebook_live_url VARCHAR(500),
  rtmp_hls_url VARCHAR(500) COMMENT 'HLS playback URL for RTMP streams',
  custom_embed_url VARCHAR(500) COMMENT 'Any iframe-embeddable URL',
  preferred_platform ENUM('youtube','zoom','google_meet','facebook','rtmp','custom') DEFAULT 'youtube',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_org (org_id)
);

-- Parliamentary motions raised during a meeting
CREATE TABLE IF NOT EXISTS gc_portal_motions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  org_id VARCHAR(255) NOT NULL,
  broadcast_id INT UNSIGNED NOT NULL,
  meeting_id INT UNSIGNED NOT NULL,
  agenda_item_id INT UNSIGNED,
  motion_type ENUM('motion','resolution','ordinance','bylaw','amendment','procedural') NOT NULL DEFAULT 'motion',
  title VARCHAR(500) NOT NULL,
  description TEXT,
  moved_by VARCHAR(255),
  seconded_by VARCHAR(255),
  status ENUM('pending','open','passed','failed','tabled','withdrawn','amended') NOT NULL DEFAULT 'pending',
  vote_result_summary VARCHAR(255),
  ordinal INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_org_broadcast (org_id, broadcast_id),
  KEY idx_meeting (meeting_id)
);

-- Individual council member votes on a motion
CREATE TABLE IF NOT EXISTS gc_portal_votes (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  org_id VARCHAR(255) NOT NULL,
  motion_id INT UNSIGNED NOT NULL,
  broadcast_id INT UNSIGNED NOT NULL,
  member_name VARCHAR(255) NOT NULL,
  member_id VARCHAR(255),
  vote ENUM('aye','nay','abstain','absent') NOT NULL,
  voted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_motion (motion_id),
  KEY idx_org (org_id),
  UNIQUE KEY uq_motion_member (motion_id, member_name)
);

-- Roll call attendance
CREATE TABLE IF NOT EXISTS gc_portal_attendance (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  org_id VARCHAR(255) NOT NULL,
  meeting_id INT UNSIGNED NOT NULL,
  broadcast_id INT UNSIGNED NOT NULL,
  member_name VARCHAR(255) NOT NULL,
  member_id VARCHAR(255),
  status ENUM('present','absent','late','excused') NOT NULL DEFAULT 'present',
  arrived_at DATETIME,
  departed_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_broadcast_member (broadcast_id, member_name),
  KEY idx_org_meeting (org_id, meeting_id)
);

-- Public comment queue
CREATE TABLE IF NOT EXISTS gc_portal_public_comments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  org_id VARCHAR(255) NOT NULL,
  meeting_id INT UNSIGNED NOT NULL,
  broadcast_id INT UNSIGNED,
  agenda_item_id INT UNSIGNED,
  speaker_name VARCHAR(255) NOT NULL,
  speaker_email VARCHAR(255),
  topic VARCHAR(500) NOT NULL,
  comment_text TEXT,
  status ENUM('pending','approved','spoken','rejected','withdrawn') NOT NULL DEFAULT 'pending',
  position_in_queue INT UNSIGNED,
  time_limit_seconds INT NOT NULL DEFAULT 180,
  submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  spoken_at DATETIME,
  KEY idx_org_meeting (org_id, meeting_id),
  KEY idx_broadcast (broadcast_id)
);

-- Speaker queue
CREATE TABLE IF NOT EXISTS gc_portal_speaker_queue (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  org_id VARCHAR(255) NOT NULL,
  broadcast_id INT UNSIGNED NOT NULL,
  speaker_name VARCHAR(255) NOT NULL,
  speaker_type ENUM('council_member','public','staff','guest') NOT NULL DEFAULT 'council_member',
  agenda_item_id INT UNSIGNED,
  position INT UNSIGNED NOT NULL,
  status ENUM('waiting','speaking','done','removed') NOT NULL DEFAULT 'waiting',
  time_limit_seconds INT NOT NULL DEFAULT 300,
  started_speaking_at DATETIME,
  finished_speaking_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_broadcast (broadcast_id),
  KEY idx_org (org_id)
);
`;
