-- ── SYNC ALL EXTRA COLUMNS ADDED BY NEXO CONNECT FEATURES ──────────────────
-- Run this in Supabase SQL Editor to bring the database up to date

-- PROFILES: extra columns
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS course text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS year_level text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_complete boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_banned boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS warning_count int DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trust_points int DEFAULT 3;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS suspended_until timestamptz;

-- COMMUNITIES: extra columns
ALTER TABLE communities ADD COLUMN IF NOT EXISTS cover_url text;
ALTER TABLE communities ADD COLUMN IF NOT EXISTS internal_audition boolean DEFAULT false;

-- ANNOUNCEMENTS: poll support
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS poll_options jsonb;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS poll_votes jsonb DEFAULT '{}';

-- AUDITION QUESTIONS: link to specific audition
ALTER TABLE audition_questions ADD COLUMN IF NOT EXISTS audition_id uuid REFERENCES auditions(id) ON DELETE CASCADE;

-- AUDITION RESPONSES: link to specific audition
ALTER TABLE audition_responses ADD COLUMN IF NOT EXISTS audition_id uuid REFERENCES auditions(id) ON DELETE CASCADE;

-- AUDITIONS TABLE (multiple named auditions per circle)
CREATE TABLE IF NOT EXISTS auditions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  community_id uuid REFERENCES communities(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  type text DEFAULT 'external' CHECK (type IN ('external', 'internal')),
  is_open boolean DEFAULT true,
  post_to_feed boolean DEFAULT false,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

-- REPORTS TABLE
CREATE TABLE IF NOT EXISTS reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  reported_user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  content_type text CHECK (content_type IN ('message', 'announcement', 'user', 'circle')),
  content_id text,
  content_preview text,
  reason text NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
  admin_note text,
  created_at timestamptz DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES profiles(id)
);

-- USER WARNINGS TABLE
CREATE TABLE IF NOT EXISTS user_warnings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  admin_id uuid REFERENCES profiles(id),
  type text DEFAULT 'warning' CHECK (type IN ('warning', 'ban')),
  reason text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- POST COMMENTS TABLE
CREATE TABLE IF NOT EXISTS post_comments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  announcement_id uuid REFERENCES announcements(id) ON DELETE CASCADE,
  author_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  author_name text NOT NULL,
  author_type text,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);
