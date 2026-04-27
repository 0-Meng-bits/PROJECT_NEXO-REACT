-- ============================================================
-- NEXO CONNECT — Full Database Schema
-- Run this in your Supabase SQL Editor to set up the database
-- ============================================================

-- 1. PROFILES
CREATE TABLE profiles (
  id uuid PRIMARY KEY,
  student_id text UNIQUE NOT NULL,
  full_name text NOT NULL,
  email text,
  password text,
  user_type text CHECK (user_type IN ('Student', 'Faculty', 'Admin')),
  department text,
  interests text[],
  id_photo_url text,
  is_verified boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- 2. COMMUNITIES
CREATE TABLE communities (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  category text,
  icon text,
  creator_id uuid REFERENCES profiles(id),
  is_official boolean DEFAULT false,
  audition_enabled boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- 3. MEMBERSHIPS
CREATE TABLE memberships (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  community_id uuid REFERENCES communities(id) ON DELETE CASCADE,
  rank_level int DEFAULT 0,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, community_id)
);

-- 4. CHANNELS
CREATE TABLE channels (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  community_id uuid REFERENCES communities(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

-- 5. MESSAGES
CREATE TABLE messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id text REFERENCES profiles(student_id),
  full_name text,
  content text NOT NULL,
  community_id uuid REFERENCES communities(id) ON DELETE CASCADE,
  channel_id uuid REFERENCES channels(id) ON DELETE CASCADE,
  role text DEFAULT 'MEMBER',
  edited boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- 6. ANNOUNCEMENTS
CREATE TABLE announcements (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  author_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  author_name text,
  author_type text,
  title text NOT NULL,
  content text NOT NULL,
  post_type text DEFAULT 'general',
  pinned boolean DEFAULT false,
  community_id uuid REFERENCES communities(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- 7. NOTIFICATIONS
CREATE TABLE notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  message text NOT NULL,
  link_comm_id uuid REFERENCES communities(id) ON DELETE SET NULL,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- 8. AUDITION QUESTIONS
CREATE TABLE audition_questions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  community_id uuid REFERENCES communities(id) ON DELETE CASCADE,
  question text NOT NULL,
  type text DEFAULT 'text',
  options jsonb,
  order_index int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 9. AUDITION RESPONSES
CREATE TABLE audition_responses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  community_id uuid REFERENCES communities(id) ON DELETE CASCADE,
  applicant_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  answers jsonb NOT NULL,
  status text DEFAULT 'pending',
  feedback text,
  phase2_details text,
  phase2_result text,
  submitted_at timestamptz DEFAULT now(),
  reviewed_at timestamptz
);

-- 10. OPPORTUNITIES (reserved for future use)
CREATE TABLE opportunities (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  community_id uuid REFERENCES communities(id),
  poster_id uuid REFERENCES profiles(id),
  title text NOT NULL,
  content text,
  status text DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Expired')),
  created_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_messages_community_id ON messages(community_id);
CREATE INDEX idx_messages_channel_id ON messages(channel_id);
CREATE INDEX idx_memberships_user_id ON memberships(user_id);
CREATE INDEX idx_memberships_community_id ON memberships(community_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
