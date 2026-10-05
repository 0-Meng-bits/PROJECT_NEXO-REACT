-- ============================================================
-- NEXO CONNECT — MASTER SYNC SQL
-- Run this in Supabase SQL Editor to bring your live DB up to date
-- Safe to run multiple times (uses IF NOT EXISTS / ON CONFLICT)
-- ============================================================

-- ── PROFILES: missing columns ────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS course text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS year_level text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cover_url text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_complete boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_banned boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS warning_count int DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trust_points int DEFAULT 3;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS suspended_until timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS id_verified boolean DEFAULT false;

-- ── COMMUNITIES: missing columns ─────────────────────────────
ALTER TABLE communities ADD COLUMN IF NOT EXISTS cover_url text;
ALTER TABLE communities ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE communities ADD COLUMN IF NOT EXISTS internal_audition boolean DEFAULT false;

-- ── ANNOUNCEMENTS: missing columns ───────────────────────────
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS poll_options jsonb;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS poll_votes jsonb DEFAULT '{}';
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS author_student_id text;

-- ── MESSAGES: missing columns ────────────────────────────────
ALTER TABLE messages ADD COLUMN IF NOT EXISTS edited boolean DEFAULT false;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS message_type text DEFAULT 'text';
ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_url text;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_size bigint;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_duration int;

-- ── CHANNELS: missing columns ────────────────────────────────
ALTER TABLE channels ADD COLUMN IF NOT EXISTS channel_type text DEFAULT 'chat';

-- ── CAMPUS EVENTS TABLE ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS campus_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  category text DEFAULT 'general',
  start_date date NOT NULL,
  end_date date,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

-- ── REPORTS TABLE ────────────────────────────────────────────
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

-- ── USER WARNINGS TABLE ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_warnings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  admin_id uuid REFERENCES profiles(id),
  type text DEFAULT 'warning' CHECK (type IN ('warning', 'ban')),
  reason text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- ── POST COMMENTS TABLE ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS post_comments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  announcement_id uuid REFERENCES announcements(id) ON DELETE CASCADE,
  author_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  author_name text NOT NULL,
  author_type text,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- ── AUDITIONS TABLE ──────────────────────────────────────────
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

-- ── MESSAGE REACTIONS TABLE ──────────────────────────────────
CREATE TABLE IF NOT EXISTS message_reactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id uuid REFERENCES messages(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

-- ── CIRCLE REQUESTS TABLE ────────────────────────────────────
CREATE TABLE IF NOT EXISTS circle_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  category text DEFAULT 'academic',
  icon text DEFAULT 'fa-solid fa-graduation-cap',
  creator_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES profiles(id)
);

-- ── MESSAGE READS TABLE ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS message_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  reader_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  read_at timestamptz DEFAULT now(),
  UNIQUE(message_id, reader_id)
);

-- ── TASK ITEMS TABLE ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS task_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid REFERENCES channels(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  assigned_to uuid REFERENCES profiles(id) ON DELETE SET NULL,
  status text DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
  priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  due_date timestamptz,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- ── SHOP ITEMS TABLE ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shop_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  type text NOT NULL CHECK (type IN ('theme', 'badge', 'background', 'name_color', 'music', 'avatar_border')),
  price int NOT NULL DEFAULT 0,
  preview_url text,
  css_data jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- ── USER PURCHASES TABLE ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  item_id uuid REFERENCES shop_items(id) ON DELETE CASCADE,
  purchased_at timestamptz DEFAULT now(),
  UNIQUE(user_id, item_id)
);

-- ── USER PROFILE SETTINGS TABLE ──────────────────────────────
CREATE TABLE IF NOT EXISTS user_profile_settings (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  active_theme uuid REFERENCES shop_items(id),
  active_badge uuid REFERENCES shop_items(id),
  active_background uuid REFERENCES shop_items(id),
  active_name_color uuid REFERENCES shop_items(id),
  active_music uuid REFERENCES shop_items(id),
  active_avatar_border uuid REFERENCES shop_items(id),
  updated_at timestamptz DEFAULT now()
);

-- ── STORAGE BUCKETS ──────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'id-photos', 'id-photos', true, 5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
) ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-media', 'chat-media', true, 52428800,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif',
        'video/mp4', 'video/webm', 'video/quicktime',
        'audio/webm', 'audio/mpeg', 'audio/ogg', 'audio/wav']
) ON CONFLICT (id) DO NOTHING;

-- ── RLS: ENABLE ON NEW TABLES ────────────────────────────────
ALTER TABLE campus_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_warnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE circle_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profile_settings ENABLE ROW LEVEL SECURITY;

-- ── RLS POLICIES ─────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='campus_events' AND policyname='Public read campus events') THEN
    CREATE POLICY "Public read campus events" ON campus_events FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='campus_events' AND policyname='Public insert campus events') THEN
    CREATE POLICY "Public insert campus events" ON campus_events FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='campus_events' AND policyname='Public delete campus events') THEN
    CREATE POLICY "Public delete campus events" ON campus_events FOR DELETE USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='reports' AND policyname='Public read reports') THEN
    CREATE POLICY "Public read reports" ON reports FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='reports' AND policyname='Users can insert reports') THEN
    CREATE POLICY "Users can insert reports" ON reports FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='reports' AND policyname='Users can update reports') THEN
    CREATE POLICY "Users can update reports" ON reports FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_warnings' AND policyname='Public read warnings') THEN
    CREATE POLICY "Public read warnings" ON user_warnings FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_warnings' AND policyname='Public insert warnings') THEN
    CREATE POLICY "Public insert warnings" ON user_warnings FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='post_comments' AND policyname='Public read comments') THEN
    CREATE POLICY "Public read comments" ON post_comments FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='post_comments' AND policyname='Users can insert comments') THEN
    CREATE POLICY "Users can insert comments" ON post_comments FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='post_comments' AND policyname='Users can delete comments') THEN
    CREATE POLICY "Users can delete comments" ON post_comments FOR DELETE USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='message_reactions' AND policyname='Public read reactions') THEN
    CREATE POLICY "Public read reactions" ON message_reactions FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='message_reactions' AND policyname='Users can insert reactions') THEN
    CREATE POLICY "Users can insert reactions" ON message_reactions FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='message_reactions' AND policyname='Users can delete reactions') THEN
    CREATE POLICY "Users can delete reactions" ON message_reactions FOR DELETE USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='circle_requests' AND policyname='Public read circle requests') THEN
    CREATE POLICY "Public read circle requests" ON circle_requests FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='circle_requests' AND policyname='Users can create circle requests') THEN
    CREATE POLICY "Users can create circle requests" ON circle_requests FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='circle_requests' AND policyname='Admins can update circle requests') THEN
    CREATE POLICY "Admins can update circle requests" ON circle_requests FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='message_reads' AND policyname='Public read message reads') THEN
    CREATE POLICY "Public read message reads" ON message_reads FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='message_reads' AND policyname='Users can insert reads') THEN
    CREATE POLICY "Users can insert reads" ON message_reads FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='task_items' AND policyname='Public read tasks') THEN
    CREATE POLICY "Public read tasks" ON task_items FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='task_items' AND policyname='Users can manage tasks') THEN
    CREATE POLICY "Users can manage tasks" ON task_items FOR ALL WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='shop_items' AND policyname='Anyone can view shop items') THEN
    CREATE POLICY "Anyone can view shop items" ON shop_items FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_purchases' AND policyname='Users can view purchases') THEN
    CREATE POLICY "Users can view purchases" ON user_purchases FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_purchases' AND policyname='Users can insert purchases') THEN
    CREATE POLICY "Users can insert purchases" ON user_purchases FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_profile_settings' AND policyname='Users can manage own settings') THEN
    CREATE POLICY "Users can manage own settings" ON user_profile_settings FOR ALL WITH CHECK (true);
  END IF;
END $$;

-- ── STORAGE POLICIES ─────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND policyname='Public can view id photos') THEN
    CREATE POLICY "Public can view id photos" ON storage.objects FOR SELECT TO public USING (bucket_id = 'id-photos');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND policyname='Service role can upload id photos') THEN
    CREATE POLICY "Service role can upload id photos" ON storage.objects FOR INSERT TO service_role WITH CHECK (bucket_id = 'id-photos');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND policyname='Public can view chat media') THEN
    CREATE POLICY "Public can view chat media" ON storage.objects FOR SELECT TO public USING (bucket_id = 'chat-media');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND policyname='Authenticated users can upload chat media') THEN
    CREATE POLICY "Authenticated users can upload chat media" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'chat-media');
  END IF;
END $$;

-- ── FIX GARBLED REPORT REASONS ───────────────────────────────
UPDATE reports
SET reason = 'Auto-detected: inappropriate language'
WHERE reason LIKE '%Auto-detected%'
  AND reason != 'Auto-detected: inappropriate language';

-- ============================================================
-- DONE! Your Supabase database is now fully synced.
-- ============================================================

-- ── NEW MIGRATIONS FROM LATEST PULL ─────────────────────────

-- Showcase feedback table
CREATE TABLE IF NOT EXISTS showcase_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tag_type text NOT NULL CHECK (tag_type IN ('effort', 'creative', 'technique', 'style', 'impact')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(announcement_id, user_id, tag_type)
);
ALTER TABLE showcase_feedback ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='showcase_feedback' AND policyname='Anyone can view showcase feedback') THEN
    CREATE POLICY "Anyone can view showcase feedback" ON showcase_feedback FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='showcase_feedback' AND policyname='Users can add their own feedback') THEN
    CREATE POLICY "Users can add their own feedback" ON showcase_feedback FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='showcase_feedback' AND policyname='Users can remove their own feedback') THEN
    CREATE POLICY "Users can remove their own feedback" ON showcase_feedback FOR DELETE USING (true);
  END IF;
END $$;

-- Poll event metadata
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS event_metadata jsonb;

-- Campus events: add community_id
ALTER TABLE campus_events ADD COLUMN IF NOT EXISTS community_id uuid REFERENCES communities(id) ON DELETE CASCADE;

-- Memberships: add project_role
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS project_role text CHECK (project_role IN ('Leader', 'Developer', 'Designer', 'Tester', 'Other'));

-- Shop items: add companion type
DO $$ BEGIN
  ALTER TABLE shop_items DROP CONSTRAINT IF EXISTS shop_items_type_check;
  ALTER TABLE shop_items ADD CONSTRAINT shop_items_type_check
    CHECK (type IN ('theme', 'badge', 'background', 'name_color', 'music', 'avatar_border', 'companion'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- User profile settings: add companion column
ALTER TABLE user_profile_settings ADD COLUMN IF NOT EXISTS active_companion uuid REFERENCES shop_items(id) ON DELETE SET NULL;

-- ============================================================
-- FULLY SYNCED WITH LATEST PULL (Oct 5, 2026)
-- ============================================================
