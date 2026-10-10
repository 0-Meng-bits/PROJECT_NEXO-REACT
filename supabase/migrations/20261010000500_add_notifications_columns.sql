-- Migration: Add category, group_key, and group_count columns to notifications
-- Requirements: 10.5

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS category text CHECK (category IN ('Connections', 'Circles', 'Campus')),
  ADD COLUMN IF NOT EXISTS group_key text,
  ADD COLUMN IF NOT EXISTS group_count int NOT NULL DEFAULT 1;
