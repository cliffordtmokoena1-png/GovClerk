-- =============================================================================
-- Portal Email Verifications: Fix column name mismatch
-- 
-- The live table was created from db/portal-auth-schema.sql with columns
-- `code` and `used`, but application code (register.ts, verify-email.ts)
-- references `verification_code` and `is_verified` from portal-auth/schema.ts.
--
-- This migration renames the two columns to match what the code expects.
-- ONLY touches gc_portal_email_verifications — no other tables are affected.
-- =============================================================================

-- Rename 'code' → 'verification_code' (widen from VARCHAR(6) to VARCHAR(10) to match schema.ts)
ALTER TABLE gc_portal_email_verifications
  CHANGE COLUMN code verification_code VARCHAR(10) NOT NULL;

-- Rename 'used' → 'is_verified'
ALTER TABLE gc_portal_email_verifications
  CHANGE COLUMN used is_verified TINYINT(1) NOT NULL DEFAULT 0;

-- Update indexes to match portal-auth/schema.ts
-- Drop old index on (email, code) and add new ones.
-- The DROP IF EXISTS guards allow this migration to be re-run safely.
ALTER TABLE gc_portal_email_verifications
  DROP INDEX idx_email_code;

ALTER TABLE gc_portal_email_verifications
  DROP INDEX IF EXISTS idx_org_email;

ALTER TABLE gc_portal_email_verifications
  DROP INDEX IF EXISTS idx_email;

ALTER TABLE gc_portal_email_verifications
  ADD INDEX idx_org_email (org_id, email);

ALTER TABLE gc_portal_email_verifications
  ADD INDEX idx_email (email);
