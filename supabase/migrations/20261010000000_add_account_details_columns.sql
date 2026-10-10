-- Migration: Add gender and discoverable columns to account_details
-- Requirements: 10.1

ALTER TABLE account_details
  ADD COLUMN IF NOT EXISTS gender text CHECK (gender IN ('Male', 'Female', 'Prefer not to say')),
  ADD COLUMN IF NOT EXISTS discoverable boolean NOT NULL DEFAULT true;
