-- Migration: Add missing columns to gc_portal_quote_requests
-- Run this on PlanetScale to fix the "Unknown column 'selected_plan'" error
-- that occurs when the portal quote-request form is submitted.

ALTER TABLE gc_portal_quote_requests ADD COLUMN selected_plan VARCHAR(50) NULL AFTER additional_notes;
ALTER TABLE gc_portal_quote_requests ADD COLUMN estimated_streaming_hours DECIMAL(10,2) NULL AFTER selected_plan;
ALTER TABLE gc_portal_quote_requests ADD COLUMN website_url VARCHAR(500) NULL AFTER estimated_streaming_hours;
