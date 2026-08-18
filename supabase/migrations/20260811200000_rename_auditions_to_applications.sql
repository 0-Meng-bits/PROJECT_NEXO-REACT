-- =========================================================
-- MIGRATION: Rename auditions → applications
-- Date: 2026-08-11
-- Purpose: Use more generic terminology for all circle types
-- =========================================================

-- 1. Rename the main tables (only if they exist)
DO $$ 
BEGIN
  -- Rename auditions to applications
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'auditions') THEN
    ALTER TABLE auditions RENAME TO applications;
  END IF;

  -- Rename audition_questions to application_questions
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audition_questions') THEN
    ALTER TABLE audition_questions RENAME TO application_questions;
  END IF;

  -- Rename audition_responses to application_submissions
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audition_responses') THEN
    ALTER TABLE audition_responses RENAME TO application_submissions;
  END IF;
END $$;

-- 2. Rename columns that reference "audition" (only if they exist)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'applications' 
    AND column_name = 'audition_enabled'
  ) THEN
    ALTER TABLE applications RENAME COLUMN audition_enabled TO application_enabled;
  END IF;
END $$;

-- =========================================================
-- VERIFICATION
-- =========================================================
-- Run this to verify the tables were renamed:
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' 
-- AND table_name LIKE '%application%'
-- ORDER BY table_name;
