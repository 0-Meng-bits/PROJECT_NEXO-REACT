-- ============================================================
-- FIX DELETE COMMUNITY CASCADE
-- Date: 2026-09-06
-- Purpose: Allow communities to be deleted by cascading to related tables
-- ============================================================

-- Drop existing foreign key constraints and recreate with CASCADE

-- Memberships -> Communities
ALTER TABLE memberships 
DROP CONSTRAINT IF EXISTS memberships_community_id_fkey,
ADD CONSTRAINT memberships_community_id_fkey 
  FOREIGN KEY (community_id) 
  REFERENCES communities(id) 
  ON DELETE CASCADE;

-- Channels -> Communities
ALTER TABLE channels 
DROP CONSTRAINT IF EXISTS channels_community_id_fkey,
ADD CONSTRAINT channels_community_id_fkey 
  FOREIGN KEY (community_id) 
  REFERENCES communities(id) 
  ON DELETE CASCADE;

-- Messages -> Channels (cascade from communities)
ALTER TABLE messages 
DROP CONSTRAINT IF EXISTS messages_channel_id_fkey,
ADD CONSTRAINT messages_channel_id_fkey 
  FOREIGN KEY (channel_id) 
  REFERENCES channels(id) 
  ON DELETE CASCADE;

-- Message Reactions -> Messages (cascade from channels)
ALTER TABLE message_reactions 
DROP CONSTRAINT IF EXISTS message_reactions_message_id_fkey,
ADD CONSTRAINT message_reactions_message_id_fkey 
  FOREIGN KEY (message_id) 
  REFERENCES messages(id) 
  ON DELETE CASCADE;

-- Task Items -> Channels (cascade from communities)
ALTER TABLE task_items 
DROP CONSTRAINT IF EXISTS task_items_channel_id_fkey,
ADD CONSTRAINT task_items_channel_id_fkey 
  FOREIGN KEY (channel_id) 
  REFERENCES channels(id) 
  ON DELETE CASCADE;

-- Announcements -> Communities
ALTER TABLE announcements 
DROP CONSTRAINT IF EXISTS announcements_community_id_fkey,
ADD CONSTRAINT announcements_community_id_fkey 
  FOREIGN KEY (community_id) 
  REFERENCES communities(id) 
  ON DELETE CASCADE;

-- Post Comments -> Announcements (cascade from communities)
ALTER TABLE post_comments 
DROP CONSTRAINT IF EXISTS post_comments_announcement_id_fkey,
ADD CONSTRAINT post_comments_announcement_id_fkey 
  FOREIGN KEY (announcement_id) 
  REFERENCES announcements(id) 
  ON DELETE CASCADE;

-- Applications -> Communities
ALTER TABLE applications 
DROP CONSTRAINT IF EXISTS applications_community_id_fkey,
ADD CONSTRAINT applications_community_id_fkey 
  FOREIGN KEY (community_id) 
  REFERENCES communities(id) 
  ON DELETE CASCADE;

-- Application Questions -> Communities
ALTER TABLE application_questions 
DROP CONSTRAINT IF EXISTS application_questions_community_id_fkey,
ADD CONSTRAINT application_questions_community_id_fkey 
  FOREIGN KEY (community_id) 
  REFERENCES communities(id) 
  ON DELETE CASCADE;

-- Application Submissions -> Communities
ALTER TABLE application_submissions 
DROP CONSTRAINT IF EXISTS application_submissions_community_id_fkey,
ADD CONSTRAINT application_submissions_community_id_fkey 
  FOREIGN KEY (community_id) 
  REFERENCES communities(id) 
  ON DELETE CASCADE;

-- ============================================================
-- DONE! Communities can now be deleted safely with CASCADE
-- All related data will be automatically removed:
-- - Memberships
-- - Channels (and their messages, reactions, tasks)
-- - Announcements (and their comments)
-- - Applications (and questions, submissions)
-- ============================================================
