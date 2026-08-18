-- =========================================================
-- MIGRATION: Rename audition_id columns to application_id
-- Date: 2026-08-11
-- Purpose: Complete the auditions → applications rename
-- =========================================================

-- 1. Rename audition_id in application_questions
DO $ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'application_questions' 
    AND column_name = 'audition_id'
  ) THEN
    ALTER TABLE application_questions RENAME COLUMN audition_id TO application_id;
  END IF;
END $;

-- 2. Rename audition_id in application_submissions
DO $ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'application_submissions' 
    AND column_name = 'audition_id'
  ) THEN
    ALTER TABLE application_submissions RENAME COLUMN audition_id TO application_id;
  END IF;
END $;

-- =========================================================
-- VERIFICATION
-- =========================================================
-- Run this to verify columns were renamed:
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name IN ('application_questions', 'application_submissions')
-- ORDER BY table_name, ordinal_position;
