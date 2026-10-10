-- Migration: Add interest_tag, is_open, and invitees columns to circle_requests
-- Supports the updated circle creation flow with connection gate and invite list

ALTER TABLE circle_requests
  ADD COLUMN IF NOT EXISTS interest_tag text,
  ADD COLUMN IF NOT EXISTS is_open boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS invitees uuid[] NOT NULL DEFAULT '{}';
