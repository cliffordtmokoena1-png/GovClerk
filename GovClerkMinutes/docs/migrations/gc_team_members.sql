-- Migration: Create gc_team_members table
-- Run this on your PlanetScale database to enable the Members feature
-- in GovClerkMinutes Dashboard settings.

CREATE TABLE IF NOT EXISTS gc_team_members (
  id INT AUTO_INCREMENT PRIMARY KEY,
  owner_user_id VARCHAR(255) NOT NULL,
  member_email VARCHAR(255) NOT NULL,
  member_user_id VARCHAR(255) DEFAULT NULL,
  role ENUM('admin', 'member') DEFAULT 'member',
  status ENUM('pending', 'active', 'revoked') DEFAULT 'pending',
  invite_token VARCHAR(255) DEFAULT NULL,
  invited_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  accepted_at DATETIME DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_owner_member (owner_user_id, member_email)
);
