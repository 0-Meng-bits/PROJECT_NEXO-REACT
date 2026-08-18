-- =========================================================
-- MIGRATION: Update all foreign keys from profiles → accounts
-- Date: 2026-08-11
-- Purpose: Complete schema migration to new table structure
-- =========================================================

-- Drop all foreign key constraints that reference profiles
-- We'll recreate them pointing to accounts instead

-- 1. COMMUNITIES
ALTER TABLE communities 
  DROP CONSTRAINT IF EXISTS communities_creator_id_fkey;

ALTER TABLE communities 
  ADD CONSTRAINT communities_creator_id_fkey 
  FOREIGN KEY (creator_id) REFERENCES accounts(id) ON DELETE CASCADE;

-- 2. MEMBERSHIPS
ALTER TABLE memberships 
  DROP CONSTRAINT IF EXISTS memberships_user_id_fkey;

ALTER TABLE memberships 
  ADD CONSTRAINT memberships_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES accounts(id) ON DELETE CASCADE;

-- 3. MESSAGES
-- Note: messages uses student_id (text) not UUID, referencing accounts.ctu_id
ALTER TABLE messages 
  DROP CONSTRAINT IF EXISTS messages_student_id_fkey;

ALTER TABLE messages 
  ADD CONSTRAINT messages_student_id_fkey 
  FOREIGN KEY (student_id) REFERENCES accounts(ctu_id) ON DELETE CASCADE;

-- 4. ANNOUNCEMENTS
ALTER TABLE announcements 
  DROP CONSTRAINT IF EXISTS announcements_author_id_fkey;

ALTER TABLE announcements 
  ADD CONSTRAINT announcements_author_id_fkey 
  FOREIGN KEY (author_id) REFERENCES accounts(id) ON DELETE CASCADE;

-- Also update author_student_id if it exists
ALTER TABLE announcements 
  DROP CONSTRAINT IF EXISTS announcements_author_student_id_fkey;

ALTER TABLE announcements 
  ADD CONSTRAINT announcements_author_student_id_fkey 
  FOREIGN KEY (author_student_id) REFERENCES accounts(ctu_id);

-- 5. NOTIFICATIONS
ALTER TABLE notifications 
  DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;

ALTER TABLE notifications 
  ADD CONSTRAINT notifications_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES accounts(id) ON DELETE CASCADE;

-- 6. AUDITION_RESPONSES
ALTER TABLE audition_responses 
  DROP CONSTRAINT IF EXISTS audition_responses_applicant_id_fkey;

ALTER TABLE audition_responses 
  ADD CONSTRAINT audition_responses_applicant_id_fkey 
  FOREIGN KEY (applicant_id) REFERENCES accounts(id) ON DELETE CASCADE;

-- 7. CAMPUS_EVENTS
ALTER TABLE campus_events 
  DROP CONSTRAINT IF EXISTS campus_events_poster_id_fkey;

ALTER TABLE campus_events 
  ADD CONSTRAINT campus_events_poster_id_fkey 
  FOREIGN KEY (poster_id) REFERENCES accounts(id);

ALTER TABLE campus_events 
  DROP CONSTRAINT IF EXISTS campus_events_created_by_fkey;

ALTER TABLE campus_events 
  ADD CONSTRAINT campus_events_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES accounts(id);

-- 8. AUDITIONS
ALTER TABLE auditions 
  DROP CONSTRAINT IF EXISTS auditions_created_by_fkey;

ALTER TABLE auditions 
  ADD CONSTRAINT auditions_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES accounts(id);

-- 9. REPORTS
ALTER TABLE reports 
  DROP CONSTRAINT IF EXISTS reports_reporter_id_fkey;

ALTER TABLE reports 
  ADD CONSTRAINT reports_reporter_id_fkey 
  FOREIGN KEY (reporter_id) REFERENCES accounts(id) ON DELETE CASCADE;

ALTER TABLE reports 
  DROP CONSTRAINT IF EXISTS reports_reported_user_id_fkey;

ALTER TABLE reports 
  ADD CONSTRAINT reports_reported_user_id_fkey 
  FOREIGN KEY (reported_user_id) REFERENCES accounts(id) ON DELETE CASCADE;

ALTER TABLE reports 
  DROP CONSTRAINT IF EXISTS reports_reviewed_by_fkey;

ALTER TABLE reports 
  ADD CONSTRAINT reports_reviewed_by_fkey 
  FOREIGN KEY (reviewed_by) REFERENCES accounts(id);

-- 10. USER_WARNINGS
ALTER TABLE user_warnings 
  DROP CONSTRAINT IF EXISTS user_warnings_user_id_fkey;

ALTER TABLE user_warnings 
  ADD CONSTRAINT user_warnings_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES accounts(id) ON DELETE CASCADE;

ALTER TABLE user_warnings 
  DROP CONSTRAINT IF EXISTS user_warnings_admin_id_fkey;

ALTER TABLE user_warnings 
  ADD CONSTRAINT user_warnings_admin_id_fkey 
  FOREIGN KEY (admin_id) REFERENCES accounts(id);

-- 11. POST_COMMENTS
ALTER TABLE post_comments 
  DROP CONSTRAINT IF EXISTS post_comments_author_id_fkey;

ALTER TABLE post_comments 
  ADD CONSTRAINT post_comments_author_id_fkey 
  FOREIGN KEY (author_id) REFERENCES accounts(id) ON DELETE CASCADE;

-- 12. MESSAGE_REACTIONS
ALTER TABLE message_reactions 
  DROP CONSTRAINT IF EXISTS message_reactions_user_id_fkey;

ALTER TABLE message_reactions 
  ADD CONSTRAINT message_reactions_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES accounts(id) ON DELETE CASCADE;

-- 13. CIRCLE_REQUESTS
ALTER TABLE circle_requests 
  DROP CONSTRAINT IF EXISTS circle_requests_creator_id_fkey;

ALTER TABLE circle_requests 
  ADD CONSTRAINT circle_requests_creator_id_fkey 
  FOREIGN KEY (creator_id) REFERENCES accounts(id) ON DELETE CASCADE;

ALTER TABLE circle_requests 
  DROP CONSTRAINT IF EXISTS circle_requests_reviewed_by_fkey;

ALTER TABLE circle_requests 
  ADD CONSTRAINT circle_requests_reviewed_by_fkey 
  FOREIGN KEY (reviewed_by) REFERENCES accounts(id);

-- 14. MESSAGE_READS
ALTER TABLE message_reads 
  DROP CONSTRAINT IF EXISTS message_reads_reader_id_fkey;

ALTER TABLE message_reads 
  ADD CONSTRAINT message_reads_reader_id_fkey 
  FOREIGN KEY (reader_id) REFERENCES accounts(id) ON DELETE CASCADE;

-- =========================================================
-- VERIFICATION QUERY (run after migration to verify)
-- =========================================================
-- SELECT 
--   conname AS constraint_name,
--   conrelid::regclass AS table_name,
--   confrelid::regclass AS referenced_table
-- FROM pg_constraint 
-- WHERE confrelid = 'accounts'::regclass 
-- ORDER BY conrelid::regclass::text;
