-- ============================================================
-- NEXO CONNECT - Complete Database Schema
-- Date: 2026-08-11
-- Purpose: Fresh database setup for team members
-- Instructions: Run this entire file in your Supabase SQL Editor
-- ============================================================

-- ============================================================
-- CORE TABLES (Normalized Schema)
-- ============================================================

-- 1. ACCOUNTS (Core Identity)
CREATE TABLE IF NOT EXISTS accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ctu_id text UNIQUE NOT NULL,
  full_name text NOT NULL,
  email text UNIQUE NOT NULL,
  user_type text DEFAULT 'Student' CHECK (user_type IN ('Student', 'Faculty', 'Admin')),
  created_at timestamptz DEFAULT now()
);

-- 2. ACCOUNT_STATUS (Verification & Moderation)
CREATE TABLE IF NOT EXISTS account_status (
  id uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  is_verified boolean DEFAULT false,
  is_banned boolean DEFAULT false,
  suspended_until timestamptz,
  warning_count int DEFAULT 0,
  trust_points int DEFAULT 10
);

-- 3. ACCOUNT_DETAILS (Profile Information)
CREATE TABLE IF NOT EXISTS account_details (
  id uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  department text,
  course text,
  year_level text,
  interests text[],
  avatar_url text,
  cover_url text,
  id_photo_url text,
  id_verified boolean DEFAULT false,
  last_seen timestamptz,
  onboarding_complete boolean DEFAULT false
);

-- ============================================================
-- COMMUNITY TABLES
-- ============================================================

-- 4. COMMUNITIES
CREATE TABLE IF NOT EXISTS communities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid REFERENCES accounts(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  category text,
  icon text,
  cover_url text,
  is_official boolean DEFAULT false,
  application_enabled boolean DEFAULT false,
  internal_application boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- 5. MEMBERSHIPS
CREATE TABLE IF NOT EXISTS memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES accounts(id) ON DELETE CASCADE,
  community_id uuid REFERENCES communities(id) ON DELETE CASCADE,
  rank_level int DEFAULT 0,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, community_id)
);

-- 6. CHANNELS
CREATE TABLE IF NOT EXISTS channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid REFERENCES communities(id) ON DELETE CASCADE,
  created_by uuid REFERENCES accounts(id),
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 7. CIRCLE_REQUESTS
CREATE TABLE IF NOT EXISTS circle_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid REFERENCES accounts(id) ON DELETE CASCADE,
  reviewed_by uuid REFERENCES accounts(id),
  name text NOT NULL,
  description text DEFAULT '',
  category text DEFAULT 'academic',
  icon text DEFAULT 'fa-solid fa-graduation-cap',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  reviewed_at timestamptz
);

-- ============================================================
-- MESSAGING TABLES
-- ============================================================

-- 8. MESSAGES
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id text REFERENCES accounts(ctu_id) ON DELETE CASCADE,
  community_id uuid REFERENCES communities(id) ON DELETE CASCADE,
  channel_id uuid REFERENCES channels(id) ON DELETE CASCADE,
  full_name text,
  content text NOT NULL,
  role text DEFAULT 'MEMBER',
  edited boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- 9. MESSAGE_READS
CREATE TABLE IF NOT EXISTS message_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid REFERENCES messages(id) ON DELETE CASCADE,
  reader_id uuid REFERENCES accounts(id) ON DELETE CASCADE,
  read_at timestamptz DEFAULT now(),
  UNIQUE(message_id, reader_id)
);

-- 10. MESSAGE_REACTIONS
CREATE TABLE IF NOT EXISTS message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid REFERENCES messages(id) ON DELETE CASCADE,
  student_id text REFERENCES accounts(ctu_id) ON DELETE CASCADE,
  reaction text NOT NULL CHECK (reaction IN ('heart', 'laugh', 'sad')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(message_id, student_id, reaction)
);

-- ============================================================
-- CONTENT TABLES
-- ============================================================

-- 11. ANNOUNCEMENTS
CREATE TABLE IF NOT EXISTS announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid REFERENCES accounts(id) ON DELETE CASCADE,
  author_student_id text REFERENCES accounts(ctu_id),
  community_id uuid REFERENCES communities(id) ON DELETE CASCADE,
  author_name text,
  author_type text,
  title text NOT NULL,
  content text NOT NULL,
  post_type text DEFAULT 'general',
  pinned boolean DEFAULT false,
  poll_options jsonb,
  poll_votes jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- 12. POST_COMMENTS
CREATE TABLE IF NOT EXISTS post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid REFERENCES announcements(id) ON DELETE CASCADE,
  author_id uuid REFERENCES accounts(id) ON DELETE CASCADE,
  author_name text NOT NULL,
  author_type text,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- APPLICATION TABLES (formerly auditions)
-- ============================================================

-- 13. APPLICATIONS
CREATE TABLE IF NOT EXISTS applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid REFERENCES communities(id) ON DELETE CASCADE,
  created_by uuid REFERENCES accounts(id),
  title text NOT NULL,
  description text,
  type text DEFAULT 'external' CHECK (type IN ('external', 'internal')),
  is_open boolean DEFAULT true,
  post_to_feed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- 14. APPLICATION_QUESTIONS
CREATE TABLE IF NOT EXISTS application_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid REFERENCES communities(id) ON DELETE CASCADE,
  application_id uuid REFERENCES applications(id) ON DELETE CASCADE,
  question text NOT NULL,
  type text DEFAULT 'text',
  options jsonb,
  order_index int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 15. APPLICATION_SUBMISSIONS
CREATE TABLE IF NOT EXISTS application_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid REFERENCES communities(id) ON DELETE CASCADE,
  application_id uuid REFERENCES applications(id) ON DELETE CASCADE,
  applicant_id uuid REFERENCES accounts(id) ON DELETE CASCADE,
  answers jsonb NOT NULL,
  status text DEFAULT 'pending',
  feedback text,
  phase2_details text,
  phase2_result text,
  submitted_at timestamptz DEFAULT now(),
  reviewed_at timestamptz
);

-- ============================================================
-- EVENT & NOTIFICATION TABLES
-- ============================================================

-- 16. CAMPUS_EVENTS
CREATE TABLE IF NOT EXISTS campus_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poster_id uuid REFERENCES accounts(id),
  title text NOT NULL,
  description text,
  start_date date,
  start_time time,
  end_date date,
  end_time time,
  location text,
  category text,
  poster_name text,
  poster_type text,
  is_official boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- 17. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES accounts(id) ON DELETE CASCADE,
  link_comm_id uuid REFERENCES communities(id) ON DELETE SET NULL,
  type text NOT NULL,
  message text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- MODERATION TABLES
-- ============================================================

-- 18. REPORTS
CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid REFERENCES accounts(id) ON DELETE CASCADE,
  reported_user_id uuid REFERENCES accounts(id) ON DELETE CASCADE,
  reviewed_by uuid REFERENCES accounts(id),
  content_type text CHECK (content_type IN ('message', 'announcement', 'user', 'circle')),
  content_id text,
  content_preview text,
  reason text NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
  admin_note text,
  created_at timestamptz DEFAULT now(),
  reviewed_at timestamptz
);

-- 19. USER_WARNINGS
CREATE TABLE IF NOT EXISTS user_warnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES accounts(id) ON DELETE CASCADE,
  admin_id uuid REFERENCES accounts(id),
  type text DEFAULT 'warning' CHECK (type IN ('warning', 'ban')),
  reason text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_messages_community_id ON messages(community_id);
CREATE INDEX IF NOT EXISTS idx_messages_channel_id ON messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_memberships_user_id ON memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_community_id ON memberships(community_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_reactions_message_id ON message_reactions(message_id);

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================

-- Avatars bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- Storage policies for avatars
DROP POLICY IF EXISTS "Public avatar read access" ON storage.objects;
CREATE POLICY "Public avatar read access"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users can upload avatars" ON storage.objects;
CREATE POLICY "Users can upload avatars"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can update own avatars" ON storage.objects;
CREATE POLICY "Users can update own avatars"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can delete own avatars" ON storage.objects;
CREATE POLICY "Users can delete own avatars"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Service role full access to avatars" ON storage.objects;
CREATE POLICY "Service role full access to avatars"
  ON storage.objects
  TO service_role
  USING (bucket_id = 'avatars')
  WITH CHECK (bucket_id = 'avatars');

-- ============================================================
-- ROW LEVEL SECURITY (RLS) - Enable on all tables
-- ============================================================

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE campus_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_warnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE circle_requests ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- BASIC RLS POLICIES (Allow service role full access)
-- ============================================================

-- Allow service role (your backend) full access to everything
DO $$ 
DECLARE
  t text;
BEGIN
  FOR t IN 
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('
      DROP POLICY IF EXISTS "Service role full access" ON %I;
      CREATE POLICY "Service role full access" ON %I
        TO service_role USING (true) WITH CHECK (true);
    ', t, t);
  END LOOP;
END $$;

-- ============================================================
-- DONE! Your database is ready.
-- ============================================================
