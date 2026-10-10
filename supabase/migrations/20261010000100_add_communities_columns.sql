-- Migration: Add interest_tag, is_open, and status columns to communities
-- Requirements: 10.2

ALTER TABLE communities
  ADD COLUMN IF NOT EXISTS interest_tag text,
  ADD COLUMN IF NOT EXISTS is_open boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('pending', 'active'));
