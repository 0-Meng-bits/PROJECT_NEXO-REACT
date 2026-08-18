-- =========================================================
-- MIGRATION: Rename audition columns in communities table
-- Date: 2026-08-11
-- Purpose: Complete the auditions → applications terminology change
-- =========================================================

-- Rename audition_enabled to application_enabled
ALTER TABLE communities RENAME COLUMN audition_enabled TO application_enabled;

-- Rename internal_audition to internal_application
ALTER TABLE communities RENAME COLUMN internal_audition TO internal_application;
