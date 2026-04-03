-- Migration 007: Add preferred billing day and pro-rata tracking to portal subscriptions

ALTER TABLE gc_portal_subscriptions
  ADD COLUMN preferred_billing_day    TINYINT       NULL COMMENT '1–28, chosen by client at sign-up',
  ADD COLUMN prorata_amount_zar       DECIMAL(10,2) NULL COMMENT 'First-period pro-rata charge in ZAR',
  ADD COLUMN prorata_tokens           INT           NULL COMMENT 'Pro-rated tokens credited in first period (Professional only)',
  ADD COLUMN prorata_paid_at          TIMESTAMP     NULL COMMENT 'When the pro-rata charge was successfully collected',
  ADD COLUMN activation_scheduled_at  TIMESTAMP     NULL COMMENT 'When the recurring subscription was created in Paystack',
  ADD COLUMN paystack_authorization_code VARCHAR(255) NULL COMMENT 'Paystack authorization code from pro-rata transaction';

-- Extend the status enum to include pending_activation
-- MySQL requires a full column redefinition for ENUM changes:
ALTER TABLE gc_portal_subscriptions
  MODIFY COLUMN status ENUM('pending_activation','active','trial','suspended','cancelled') NOT NULL DEFAULT 'trial';

-- Add preferred_billing_day to quote requests so it can be stored from the sign-up form
ALTER TABLE gc_portal_quote_requests
  ADD COLUMN preferred_billing_day TINYINT NULL COMMENT '1–28, preferred billing day chosen by client';
