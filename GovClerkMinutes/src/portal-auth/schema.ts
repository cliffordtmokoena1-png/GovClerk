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

-- Email verification codes: 6-digit codes sent to organisational emails for identity confirmation
CREATE TABLE IF NOT EXISTS gc_portal_email_verifications (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  org_id VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  verification_code VARCHAR(10) NOT NULL,
  is_verified TINYINT(1) NOT NULL DEFAULT 0,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_org_email (org_id, email),
  KEY idx_email (email)
);
`;

export const PORTAL_RECORDS_SCHEMA = `
-- FOIA / Public Records Requests: citizens request documents not yet published
CREATE TABLE IF NOT EXISTS gc_public_records_requests (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  org_id VARCHAR(255) NOT NULL,
  requester_name VARCHAR(255) NOT NULL,
  requester_email VARCHAR(255) NOT NULL,
  requester_phone VARCHAR(50),
  request_type ENUM('foia','open_records','inspection','certification') NOT NULL DEFAULT 'foia',
  description TEXT NOT NULL COMMENT 'What records the citizen is requesting',
  date_range_from DATE COMMENT 'Optional: date range of records requested',
  date_range_to DATE,
  related_meeting_id INT UNSIGNED COMMENT 'gc_meetings.id if related to a specific meeting',
  status ENUM('received','acknowledged','in_review','fulfilled','partially_fulfilled','denied','withdrawn') NOT NULL DEFAULT 'received',
  denial_reason TEXT COMMENT 'If denied, explanation (e.g. executive privilege, personal info)',
  response_due_date DATE COMMENT 'Statutory deadline for response (typically 5-30 business days)',
  fulfilled_at DATETIME,
  response_notes TEXT COMMENT 'Clerk notes on how the request was handled',
  tracking_number VARCHAR(50) NOT NULL COMMENT 'Public-facing reference number',
  submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_org_id (org_id),
  KEY idx_tracking (tracking_number),
  KEY idx_status (status)
);

-- Meeting notices: advance public notice of upcoming meetings (Open Meetings Act compliance)
CREATE TABLE IF NOT EXISTS gc_meeting_notices (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  org_id VARCHAR(255) NOT NULL,
  meeting_id INT UNSIGNED NOT NULL COMMENT 'gc_meetings.id',
  notice_type ENUM('regular','special','emergency','executive_session','cancelled','rescheduled') NOT NULL DEFAULT 'regular',
  posted_at DATETIME NOT NULL COMMENT 'When the notice was officially posted',
  notice_text TEXT COMMENT 'Official public notice text',
  posting_location VARCHAR(500) COMMENT 'Where physically posted (e.g. City Hall bulletin board)',
  hours_notice_given INT COMMENT 'Computed: hours between posted_at and meeting time',
  is_compliant TINYINT(1) COMMENT 'Whether statutory notice period was met',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_org_meeting (org_id, meeting_id)
);

-- Document retention schedules: each artifact has a legal retention label
CREATE TABLE IF NOT EXISTS gc_document_retention (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  org_id VARCHAR(255) NOT NULL,
  artifact_id INT UNSIGNED COMMENT 'gc_artifacts.id',
  document_type VARCHAR(100) NOT NULL COMMENT 'e.g. "meeting_minutes", "ordinance", "budget"',
  retention_period VARCHAR(100) NOT NULL COMMENT 'e.g. "Permanent", "7 years", "3 years"',
  retention_basis VARCHAR(255) COMMENT 'Legal authority, e.g. "LGTA s.12(3)" or "State Archives Act"',
  destruction_date DATE COMMENT 'When the document may be destroyed (NULL = permanent)',
  is_permanent TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_org (org_id),
  KEY idx_artifact (artifact_id)
);

-- Portal announcements: org admin can post notices on the portal homepage
CREATE TABLE IF NOT EXISTS gc_portal_announcements (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  org_id VARCHAR(255) NOT NULL,
  title VARCHAR(500) NOT NULL,
  body TEXT NOT NULL,
  type ENUM('notice','alert','info','emergency') NOT NULL DEFAULT 'notice',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  published_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME COMMENT 'NULL = no expiry',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_org_active (org_id, is_active)
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
  tiktok_live_url VARCHAR(500) COMMENT 'TikTok Live URL',
  rtmp_hls_url VARCHAR(500) COMMENT 'HLS playback URL for RTMP streams',
  custom_embed_url VARCHAR(500) COMMENT 'Any iframe-embeddable URL',
  preferred_platform ENUM('youtube','zoom','google_meet','facebook','rtmp','custom','tiktok') DEFAULT 'youtube',
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
