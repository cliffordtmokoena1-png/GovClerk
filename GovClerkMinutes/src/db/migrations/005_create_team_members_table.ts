/**
 * Migration 005: Create the gc_team_members table.
 *
 * Stores team member invitations and memberships for the GovClerkMinutes
 * Dashboard. The owner_user_id is the Clerk user ID of the account owner;
 * member_email is the invited person. Once the invite is accepted,
 * member_user_id is populated with their Clerk user ID.
 *
 * Member limits are enforced in application code based on the owner's
 * subscription plan (Free=1, Essential/Basic=2, Professional/Pro=4,
 * Elite=6, Premium=10).
 */

import type { Migration } from "./index";

export const migration005: Migration = {
  id: "005",
  name: "Create gc_team_members table",
  sql: `
CREATE TABLE IF NOT EXISTS gc_team_members (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  owner_user_id   VARCHAR(255)  NOT NULL COMMENT 'Clerk user ID of the account owner',
  member_email    VARCHAR(255)  NOT NULL COMMENT 'Invited member email address',
  member_user_id  VARCHAR(255)  DEFAULT NULL COMMENT 'Clerk user ID once invite is accepted',
  role            ENUM('admin', 'member') NOT NULL DEFAULT 'member',
  status          ENUM('pending', 'active', 'revoked') NOT NULL DEFAULT 'pending',
  invite_token    VARCHAR(255)  DEFAULT NULL COMMENT 'Unique token for the invite link',
  invited_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  accepted_at     DATETIME      DEFAULT NULL,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_owner_member (owner_user_id, member_email),
  KEY idx_owner (owner_user_id),
  KEY idx_member_user (member_user_id),
  KEY idx_invite_token (invite_token),
  KEY idx_status (owner_user_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `.trim(),
};