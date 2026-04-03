-- Creates a table to track streaming minutes used per org per billing month.
-- billing_month format: 'YYYY-MM' (e.g. '2026-04')
CREATE TABLE IF NOT EXISTS gc_org_stream_usage (
  org_id VARCHAR(255) NOT NULL,
  billing_month VARCHAR(7) NOT NULL,
  minutes_used INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (org_id, billing_month)
);
