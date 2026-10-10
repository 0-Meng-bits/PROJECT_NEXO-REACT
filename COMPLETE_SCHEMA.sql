-- ============================================================
-- NEXO CONNECT - Complete Database Schema
-- Last Updated: 2026-10-04
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
  onboarding_complete boolean DEFAULT false,
  bio text
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
  logo_url text,
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
  project_role text CHECK (project_role IN ('Leader', 'Developer', 'Designer', 'Tester', 'Other')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, community_id)
);

-- 6. CHANNELS
CREATE TABLE IF NOT EXISTS channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid REFERENCES communities(id) ON DELETE CASCADE,
  created_by uuid REFERENCES accounts(id),
  name text NOT NULL,
  channel_type text DEFAULT 'chat' CHECK (channel_type IN ('chat', 'gallery', 'files', 'notes', 'tasks')),
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
  message_type text DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'video', 'voice')),
  media_url text,
  media_size bigint,
  media_duration int,
  reply_to_id uuid REFERENCES messages(id) ON DELETE SET NULL,
  reply_to_preview text,
  reply_to_author text,
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
  event_metadata jsonb,
  solution_comment_id uuid,
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

-- Add FK for solution_comment_id after post_comments exists
ALTER TABLE announcements
  ADD CONSTRAINT announcements_solution_comment_id_fkey
    FOREIGN KEY (solution_comment_id) REFERENCES post_comments(id) ON DELETE SET NULL;

-- ============================================================
-- APPLICATION TABLES
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
  community_id uuid REFERENCES communities(id) ON DELETE CASCADE,
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
  severity text DEFAULT 'minor' CHECK (severity IN ('minor', 'moderate', 'severe', 'critical')),
  points_deducted int DEFAULT 0,
  community_id uuid REFERENCES communities(id) ON DELETE SET NULL,
  status text DEFAULT 'active' CHECK (status IN ('active', 'appealed', 'overturned', 'expired')),
  appeal_reason text,
  reviewed_by uuid REFERENCES accounts(id),
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- TRUST POINTS & MODERATION SYSTEM
-- ============================================================

-- 20. POINT_TRANSACTIONS
CREATE TABLE IF NOT EXISTS point_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  amount decimal(4,1) NOT NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN (
    'warning', 'appreciation', 'daily_recovery',
    'appeal_approved', 'admin_bonus', 'harassment_penalty'
  )),
  from_user_id uuid REFERENCES accounts(id),
  community_id uuid REFERENCES communities(id),
  reason text,
  reference_id uuid,
  created_at timestamptz DEFAULT now()
);

-- 21. APPRECIATION_COOLDOWNS
CREATE TABLE IF NOT EXISTS appreciation_cooldowns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  giver_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  given_at timestamptz DEFAULT now(),
  UNIQUE(giver_id, receiver_id, given_at)
);

-- 22. USER_FLAGS
CREATE TABLE IF NOT EXISTS user_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flagged_user_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  flagger_id uuid NOT NULL REFERENCES accounts(id),
  community_id uuid REFERENCES communities(id) ON DELETE CASCADE,
  reason text NOT NULL,
  severity text DEFAULT 'moderate' CHECK (severity IN ('minor', 'moderate', 'severe', 'critical')),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed', 'warning_issued')),
  admin_notes text,
  reviewed_by uuid REFERENCES accounts(id),
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- 23. WARNING_APPEALS
CREATE TABLE IF NOT EXISTS warning_appeals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  warning_id uuid NOT NULL REFERENCES user_warnings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  appeal_reason text NOT NULL,
  evidence text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  admin_decision text,
  reviewed_by uuid REFERENCES accounts(id),
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- 24. ABUSE_PATTERNS
CREATE TABLE IF NOT EXISTS abuse_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_type text NOT NULL CHECK (pattern_type IN (
    'mass_flag_single_user', 'coordinated_flagging',
    'rapid_succession', 'circle_harassment'
  )),
  community_id uuid REFERENCES communities(id),
  target_user_id uuid REFERENCES accounts(id),
  flagger_ids uuid[],
  detected_at timestamptz DEFAULT now(),
  severity text DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high')),
  status text DEFAULT 'reviewing' CHECK (status IN ('reviewing', 'confirmed', 'false_alarm')),
  admin_notes text
);

-- ============================================================
-- PROFILE CUSTOMIZATION SHOP
-- ============================================================

-- 25. SHOP_ITEMS
CREATE TABLE IF NOT EXISTS shop_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  type text NOT NULL CHECK (type IN ('theme', 'badge', 'background', 'name_color', 'music', 'avatar_border', 'companion')),
  price int NOT NULL DEFAULT 0,
  preview_url text,
  css_data jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 26. USER_PURCHASES
CREATE TABLE IF NOT EXISTS user_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES accounts(id) ON DELETE CASCADE,
  item_id uuid REFERENCES shop_items(id) ON DELETE CASCADE,
  purchased_at timestamptz DEFAULT now(),
  UNIQUE(user_id, item_id)
);

-- 27. USER_PROFILE_SETTINGS
CREATE TABLE IF NOT EXISTS user_profile_settings (
  user_id uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  active_theme uuid REFERENCES shop_items(id),
  active_badge uuid REFERENCES shop_items(id),
  active_background uuid REFERENCES shop_items(id),
  active_name_color uuid REFERENCES shop_items(id),
  active_music uuid REFERENCES shop_items(id),
  active_avatar_border uuid REFERENCES shop_items(id),
  active_companion uuid REFERENCES shop_items(id),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================
-- TASK SYSTEM
-- ============================================================

-- 28. TASK_ITEMS
CREATE TABLE IF NOT EXISTS task_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid REFERENCES channels(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  assigned_to uuid REFERENCES accounts(id) ON DELETE SET NULL,
  status text DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
  priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  due_date timestamptz,
  created_by uuid REFERENCES accounts(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- ============================================================
-- SHOWCASE FEEDBACK
-- ============================================================

-- 29. SHOWCASE_FEEDBACK
CREATE TABLE IF NOT EXISTS showcase_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  tag_type text NOT NULL CHECK (tag_type IN ('effort', 'creative', 'technique', 'style', 'impact')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(announcement_id, user_id, tag_type)
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
CREATE INDEX IF NOT EXISTS idx_point_transactions_user ON point_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_point_transactions_date ON point_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_point_transactions_type ON point_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_cooldowns_giver ON appreciation_cooldowns(giver_id, given_at);
CREATE INDEX IF NOT EXISTS idx_cooldowns_receiver ON appreciation_cooldowns(receiver_id);
CREATE INDEX IF NOT EXISTS idx_flags_user ON user_flags(flagged_user_id);
CREATE INDEX IF NOT EXISTS idx_flags_status ON user_flags(status);
CREATE INDEX IF NOT EXISTS idx_flags_community ON user_flags(community_id);
CREATE INDEX IF NOT EXISTS idx_appeals_warning ON warning_appeals(warning_id);
CREATE INDEX IF NOT EXISTS idx_appeals_status ON warning_appeals(status);
CREATE INDEX IF NOT EXISTS idx_appeals_user ON warning_appeals(user_id);
CREATE INDEX IF NOT EXISTS idx_abuse_target ON abuse_patterns(target_user_id);
CREATE INDEX IF NOT EXISTS idx_abuse_community ON abuse_patterns(community_id);
CREATE INDEX IF NOT EXISTS idx_abuse_status ON abuse_patterns(status);
CREATE INDEX IF NOT EXISTS idx_shop_items_type ON shop_items(type);
CREATE INDEX IF NOT EXISTS idx_shop_items_active ON shop_items(is_active);
CREATE INDEX IF NOT EXISTS idx_user_purchases_user ON user_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_user_purchases_item ON user_purchases(item_id);
CREATE INDEX IF NOT EXISTS idx_channels_type ON channels(channel_type);
CREATE INDEX IF NOT EXISTS idx_task_items_channel ON task_items(channel_id);
CREATE INDEX IF NOT EXISTS idx_task_items_assigned ON task_items(assigned_to);
CREATE INDEX IF NOT EXISTS idx_task_items_status ON task_items(status);
CREATE INDEX IF NOT EXISTS idx_task_items_due_date ON task_items(due_date);
CREATE INDEX IF NOT EXISTS idx_showcase_feedback_announcement ON showcase_feedback(announcement_id);
CREATE INDEX IF NOT EXISTS idx_showcase_feedback_user ON showcase_feedback(user_id, announcement_id);
CREATE INDEX IF NOT EXISTS idx_announcements_event_metadata ON announcements(event_metadata) WHERE event_metadata IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_announcements_social_polls ON announcements(community_id, post_type) WHERE post_type = 'poll';
CREATE INDEX IF NOT EXISTS idx_campus_events_community_date ON campus_events(community_id, start_date);

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars', 'avatars', true, 5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-media', 'chat-media', true, 52428800,
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4', 'video/webm', 'video/quicktime',
    'audio/webm', 'audio/mpeg', 'audio/ogg', 'audio/wav'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STORAGE POLICIES
-- ============================================================

DROP POLICY IF EXISTS "Public avatar read access" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Service role full access to avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow avatar uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow avatar updates" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Public can view chat media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload chat media" ON storage.objects;
DROP POLICY IF EXISTS "Service role can manage chat media" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own chat media" ON storage.objects;
DROP POLICY IF EXISTS "Allow chat media uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow chat media updates" ON storage.objects;
DROP POLICY IF EXISTS "Members can view chat media" ON storage.objects;

CREATE POLICY "Anyone can view avatars"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'avatars');

CREATE POLICY "Allow avatar uploads"
  ON storage.objects FOR INSERT TO public
  WITH CHECK (bucket_id = 'avatars' AND (auth.role() = 'authenticated' OR auth.role() = 'service_role'));

CREATE POLICY "Allow avatar updates"
  ON storage.objects FOR UPDATE TO public
  USING (bucket_id = 'avatars')
  WITH CHECK (bucket_id = 'avatars' AND (auth.role() = 'authenticated' OR auth.role() = 'service_role'));

CREATE POLICY "Users can delete own avatars"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Members can view chat media"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'chat-media');

CREATE POLICY "Allow chat media uploads"
  ON storage.objects FOR INSERT TO public
  WITH CHECK (bucket_id = 'chat-media' AND (auth.role() = 'authenticated' OR auth.role() = 'service_role'));

CREATE POLICY "Allow chat media updates"
  ON storage.objects FOR UPDATE TO public
  USING (bucket_id = 'chat-media')
  WITH CHECK (bucket_id = 'chat-media' AND (auth.role() = 'authenticated' OR auth.role() = 'service_role'));

-- ============================================================
-- PROFILE PHOTOS
-- ============================================================

-- Profile photos (max 2 slots per user)
CREATE TABLE IF NOT EXISTS profile_photos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES accounts(id) ON DELETE CASCADE,
  photo_url text NOT NULL,
  slot int NOT NULL CHECK (slot IN (1, 2)),
  is_public boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, slot)
);

-- Profile photo reactions (heart reacts)
CREATE TABLE IF NOT EXISTS profile_photo_reactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  photo_id uuid REFERENCES profile_photos(id) ON DELETE CASCADE,
  user_id uuid REFERENCES accounts(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(photo_id, user_id)
);

-- Comment hearts
CREATE TABLE IF NOT EXISTS comment_hearts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  comment_id uuid REFERENCES post_comments(id) ON DELETE CASCADE,
  user_id uuid REFERENCES accounts(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(comment_id, user_id)
);

-- ============================================================
-- ROW LEVEL SECURITY - Enable on all tables
-- ============================================================

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE circle_requests ENABLE ROW LEVEL SECURITY;
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
ALTER TABLE point_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE appreciation_cooldowns ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE warning_appeals ENABLE ROW LEVEL SECURITY;
ALTER TABLE abuse_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profile_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE showcase_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_photo_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_hearts ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- Service role gets full access to all tables
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

-- Communities: anyone authenticated can read
DROP POLICY IF EXISTS "Anyone can read communities" ON communities;
CREATE POLICY "Anyone can read communities"
  ON communities FOR SELECT TO authenticated
  USING (true);

-- Campus events: public + members see circle events
DROP POLICY IF EXISTS "Users see campus-wide or their circle events" ON campus_events;
CREATE POLICY "Users see campus-wide or their circle events"
  ON campus_events FOR SELECT
  USING (
    community_id IS NULL
    OR EXISTS (
      SELECT 1 FROM memberships
      WHERE memberships.community_id = campus_events.community_id
        AND memberships.user_id = auth.uid()
        AND memberships.status = 'active'
    )
  );

DROP POLICY IF EXISTS "No direct inserts from frontend" ON campus_events;
CREATE POLICY "No direct inserts from frontend"
  ON campus_events FOR INSERT WITH CHECK (false);

DROP POLICY IF EXISTS "No direct deletes from frontend" ON campus_events;
CREATE POLICY "No direct deletes from frontend"
  ON campus_events FOR DELETE USING (false);

-- Account details: users can read/update their own
DROP POLICY IF EXISTS "Users can update own profile" ON account_details;
CREATE POLICY "Users can update own profile"
  ON account_details FOR UPDATE TO public
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON account_details;
CREATE POLICY "Users can insert own profile"
  ON account_details FOR INSERT TO public
  WITH CHECK (auth.uid() = id);

-- Point transactions: users read own
DROP POLICY IF EXISTS "Users can read own transactions" ON point_transactions;
CREATE POLICY "Users can read own transactions"
  ON point_transactions FOR SELECT
  USING (auth.uid() = user_id);

-- Appreciation cooldowns
DROP POLICY IF EXISTS "Users can read own cooldowns" ON appreciation_cooldowns;
CREATE POLICY "Users can read own cooldowns"
  ON appreciation_cooldowns FOR SELECT
  USING (auth.uid() = giver_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "Users can insert cooldowns" ON appreciation_cooldowns;
CREATE POLICY "Users can insert cooldowns"
  ON appreciation_cooldowns FOR INSERT
  WITH CHECK (auth.uid() = giver_id);

-- User flags
DROP POLICY IF EXISTS "Users can read own flags" ON user_flags;
CREATE POLICY "Users can read own flags"
  ON user_flags FOR SELECT
  USING (auth.uid() = flagged_user_id);

DROP POLICY IF EXISTS "Leaders can create flags" ON user_flags;
CREATE POLICY "Leaders can create flags"
  ON user_flags FOR INSERT
  WITH CHECK (auth.uid() = flagger_id);

-- Warning appeals
DROP POLICY IF EXISTS "Users can read own appeals" ON warning_appeals;
CREATE POLICY "Users can read own appeals"
  ON warning_appeals FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create appeals" ON warning_appeals;
CREATE POLICY "Users can create appeals"
  ON warning_appeals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Shop items: anyone can view active items
DROP POLICY IF EXISTS "Anyone can view shop items" ON shop_items;
CREATE POLICY "Anyone can view shop items"
  ON shop_items FOR SELECT TO public
  USING (is_active = true);

-- User purchases
DROP POLICY IF EXISTS "Users can view own purchases" ON user_purchases;
CREATE POLICY "Users can view own purchases"
  ON user_purchases FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own purchases" ON user_purchases;
CREATE POLICY "Users can insert own purchases"
  ON user_purchases FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- User profile settings
DROP POLICY IF EXISTS "Users can view own profile settings" ON user_profile_settings;
CREATE POLICY "Users can view own profile settings"
  ON user_profile_settings FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own profile settings" ON user_profile_settings;
CREATE POLICY "Users can insert own profile settings"
  ON user_profile_settings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own profile settings" ON user_profile_settings;
CREATE POLICY "Users can update own profile settings"
  ON user_profile_settings FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Task items: circle members can CRUD
DROP POLICY IF EXISTS "Circle members can view tasks" ON task_items;
CREATE POLICY "Circle members can view tasks"
  ON task_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM memberships m
      JOIN channels c ON c.community_id = m.community_id
      WHERE c.id = task_items.channel_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Circle members can create tasks" ON task_items;
CREATE POLICY "Circle members can create tasks"
  ON task_items FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM memberships m
      JOIN channels c ON c.community_id = m.community_id
      WHERE c.id = channel_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Circle members can update tasks" ON task_items;
CREATE POLICY "Circle members can update tasks"
  ON task_items FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM memberships m
      JOIN channels c ON c.community_id = m.community_id
      WHERE c.id = channel_id AND m.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM memberships m
      JOIN channels c ON c.community_id = m.community_id
      WHERE c.id = channel_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Task creator or moderators can delete" ON task_items;
CREATE POLICY "Task creator or moderators can delete"
  ON task_items FOR DELETE TO authenticated
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM memberships m
      JOIN channels c ON c.community_id = m.community_id
      WHERE c.id = task_items.channel_id
        AND m.user_id = auth.uid()
        AND m.rank_level >= 1
    )
  );

-- Memberships: leaders can update member roles
DROP POLICY IF EXISTS "Community leaders can update member roles" ON memberships;
CREATE POLICY "Community leaders can update member roles"
  ON memberships FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM memberships caller
      WHERE caller.user_id = auth.uid()
        AND caller.community_id = memberships.community_id
        AND caller.rank_level >= 1
        AND caller.status = 'approved'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM memberships caller
      WHERE caller.user_id = auth.uid()
        AND caller.community_id = memberships.community_id
        AND caller.rank_level >= 1
        AND caller.status = 'approved'
    )
  );

-- Showcase feedback
DROP POLICY IF EXISTS "Anyone can view showcase feedback" ON showcase_feedback;
CREATE POLICY "Anyone can view showcase feedback"
  ON showcase_feedback FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can add their own feedback" ON showcase_feedback;
CREATE POLICY "Users can add their own feedback"
  ON showcase_feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can remove their own feedback" ON showcase_feedback;
CREATE POLICY "Users can remove their own feedback"
  ON showcase_feedback FOR DELETE
  USING (auth.uid() = user_id);

-- Announcements: OP or community creator can update (for Q&A solution marking)
DROP POLICY IF EXISTS "OP or creator can mark solution" ON announcements;
CREATE POLICY "OP or creator can mark solution"
  ON announcements FOR UPDATE TO authenticated
  USING (
    auth.uid() = author_id
    OR EXISTS (
      SELECT 1 FROM communities
      WHERE communities.id = announcements.community_id
        AND communities.creator_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = author_id
    OR EXISTS (
      SELECT 1 FROM communities
      WHERE communities.id = announcements.community_id
        AND communities.creator_id = auth.uid()
    )
  );

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION get_user_trust_points(target_user_id uuid)
RETURNS decimal(4,1) AS $$
DECLARE
  total_points decimal(4,1);
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO total_points
  FROM point_transactions WHERE user_id = target_user_id;
  IF total_points < 0 THEN total_points := 0;
  ELSIF total_points > 20 THEN total_points := 20;
  END IF;
  RETURN total_points;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION can_give_appreciation(p_giver_id uuid, p_receiver_id uuid)
RETURNS boolean AS $$
DECLARE last_given timestamptz;
BEGIN
  IF p_giver_id = p_receiver_id THEN RETURN false; END IF;
  SELECT MAX(given_at) INTO last_given
  FROM appreciation_cooldowns
  WHERE giver_id = p_giver_id AND receiver_id = p_receiver_id;
  IF last_given IS NULL THEN RETURN true; END IF;
  RETURN NOW() - last_given >= INTERVAL '12 hours';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION check_auto_suspension(target_user_id uuid)
RETURNS void AS $$
DECLARE current_points decimal(4,1);
BEGIN
  current_points := get_user_trust_points(target_user_id);
  IF current_points <= 0 THEN
    UPDATE account_status SET is_banned = true, suspended_until = NULL
    WHERE id = target_user_id AND NOT is_banned;
    INSERT INTO notifications (user_id, type, message)
    VALUES (target_user_id, 'join_denied', '⛔ Your account has been permanently banned due to trust points reaching 0.');
    RETURN;
  END IF;
  IF current_points >= 1 AND current_points <= 3 THEN
    UPDATE account_status SET is_banned = false, suspended_until = NOW() + INTERVAL '7 days'
    WHERE id = target_user_id AND (suspended_until IS NULL OR suspended_until < NOW() + INTERVAL '7 days');
    RETURN;
  END IF;
  IF current_points >= 7 THEN
    UPDATE account_status SET is_banned = false, suspended_until = NULL
    WHERE id = target_user_id AND (is_banned = true OR suspended_until IS NOT NULL);
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trigger_check_suspension()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM check_auto_suspension(NEW.user_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_suspension_trigger ON point_transactions;
CREATE TRIGGER auto_suspension_trigger
  AFTER INSERT ON point_transactions
  FOR EACH ROW EXECUTE FUNCTION trigger_check_suspension();

-- ============================================================
-- SEED DATA - Shop Items
-- ============================================================

-- Themes
INSERT INTO shop_items (name, description, type, price, css_data) VALUES
  ('Cyber Blue', 'Classic neon blue theme', 'theme', 5, '{"primary": "#00f0ff", "secondary": "#0080ff", "gradient": "linear-gradient(135deg, #00f0ff, #0080ff)"}'),
  ('Sunset Orange', 'Warm sunset gradient', 'theme', 5, '{"primary": "#ff6b35", "secondary": "#f7931e", "gradient": "linear-gradient(135deg, #ff6b35, #f7931e)"}'),
  ('Neon Purple', 'Electric purple vibes', 'theme', 8, '{"primary": "#a855f7", "secondary": "#ec4899", "gradient": "linear-gradient(135deg, #a855f7, #ec4899)"}'),
  ('Matrix Green', 'Classic hacker aesthetic', 'theme', 8, '{"primary": "#00ff41", "secondary": "#00d930", "gradient": "linear-gradient(135deg, #00ff41, #00d930)"}')
ON CONFLICT DO NOTHING;

-- Badges
INSERT INTO shop_items (name, description, type, price, preview_url) VALUES
  ('Star Badge', 'Golden star next to your name', 'badge', 3, '⭐'),
  ('Fire Badge', 'You''re on fire!', 'badge', 3, '🔥'),
  ('Crown Badge', 'Royal status', 'badge', 5, '👑'),
  ('Lightning Badge', 'Electric presence', 'badge', 4, '⚡'),
  ('Heart Badge', 'Spread the love', 'badge', 2, '💖')
ON CONFLICT DO NOTHING;

-- Name Colors
INSERT INTO shop_items (name, description, type, price, css_data) VALUES
  ('Gold Name', 'Shiny gold username', 'name_color', 3, '{"color": "#ffd700"}'),
  ('Rainbow Name', 'Rainbow gradient username', 'name_color', 5, '{"gradient": "linear-gradient(90deg, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #4b0082, #9400d3)"}'),
  ('Neon Pink', 'Hot pink username', 'name_color', 3, '{"color": "#ff10f0"}'),
  ('Ice Blue', 'Cool blue username', 'name_color', 3, '{"color": "#00d4ff"}')
ON CONFLICT DO NOTHING;

-- Backgrounds
INSERT INTO shop_items (name, description, type, price, css_data) VALUES
  ('Dots Pattern', 'Subtle dot pattern', 'background', 4, '{"pattern": "radial-gradient(circle, rgba(0,240,255,0.1) 1px, transparent 1px)", "size": "20px 20px"}'),
  ('Grid Pattern', 'Tech grid background', 'background', 4, '{"pattern": "linear-gradient(rgba(0,240,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,240,255,0.1) 1px, transparent 1px)", "size": "30px 30px"}'),
  ('Waves', 'Flowing wave pattern', 'background', 6, '{"image": "url(\"data:image/svg+xml,...\")", "backgroundSize": "100px 40px", "backgroundRepeat": "repeat"}'),
  ('Stars', 'Starry night background', 'background', 5, '{"pattern": "radial-gradient(2px 2px at 20px 30px, white, transparent), radial-gradient(2px 2px at 60px 70px, white, transparent)"}'),
  ('Straw Hat Pirates', 'One Piece Straw Hat Pirates dark wallpaper background.', 'background', 15, '{"backgroundImage": "url(https://wallpapers-clan.com/wp-content/uploads/2020/08/one-piece-straw-hat-pirates-dark-wallpaper-scaled.jpg)", "backgroundSize": "cover", "backgroundPosition": "center"}')
ON CONFLICT DO NOTHING;

-- Avatar Borders
INSERT INTO shop_items (name, description, type, price, preview_url, css_data) VALUES
  ('Gold Ring', 'Classic gold border', 'avatar_border', 3, '🥇', '{"border": "3px solid #ffd700", "boxShadow": "0 0 10px rgba(255,215,0,0.5)"}'),
  ('Neon Glow', 'Glowing cyan border', 'avatar_border', 4, '💫', '{"border": "2px solid #00f0ff", "boxShadow": "0 0 15px rgba(0,240,255,0.8)"}'),
  ('Fire Ring', 'Fiery red glow', 'avatar_border', 5, '🔥', '{"border": "3px solid #ff4500", "boxShadow": "0 0 20px rgba(255,69,0,0.8)"}'),
  ('Rainbow Ring', 'Rainbow gradient border', 'avatar_border', 6, '🌈', '{"border": "4px solid transparent", "borderImage": "linear-gradient(45deg, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #8b00ff) 1", "boxShadow": "0 0 12px rgba(255,255,255,0.5)"}'),
  ('Ice Frame', 'Frozen blue border', 'avatar_border', 4, '❄️', '{"border": "3px solid #00d4ff", "boxShadow": "0 0 15px rgba(0,212,255,0.6)"}'),
  ('Purple Aura', 'Mystical purple glow', 'avatar_border', 4, '💜', '{"border": "3px solid #9400d3", "boxShadow": "0 0 18px rgba(148,0,211,0.7)"}'),
  ('Emerald Edge', 'Green gem border', 'avatar_border', 5, '💚', '{"border": "3px solid #00ff88", "boxShadow": "0 0 15px rgba(0,255,136,0.6)"}'),
  ('Diamond Frame', 'Sparkling white border', 'avatar_border', 7, '💎', '{"border": "3px solid #ffffff", "boxShadow": "0 0 20px rgba(255,255,255,0.9), inset 0 0 10px rgba(255,255,255,0.3)"}')
ON CONFLICT DO NOTHING;

-- Companions
INSERT INTO shop_items (name, description, type, price, preview_url, css_data, is_active)
VALUES (
  'Naruto Chibi', 'Chibi Naruto companion sticker for your profile.', 'companion', 10,
  'https://banner2.cleanpng.com/cb3/qbd/tgr/a4lu9p9ci.webp',
  '{"url": "https://banner2.cleanpng.com/cb3/qbd/tgr/a4lu9p9ci.webp", "size": "64px"}',
  true
)
ON CONFLICT DO NOTHING;

-- ============================================================
-- DONE! Your database is ready.
-- All 29 tables created with indexes, RLS, and seed data.
-- ============================================================


-- ============================================================
-- NEXO CONNECT FEATURES UPDATE (2026-10-10)
-- New tables and columns added for:
-- Gender, Discoverable, Connections, Blocks, Login Streaks,
-- Notification improvements, Circle enhancements
-- ============================================================

-- New columns on account_details
ALTER TABLE account_details
  ADD COLUMN IF NOT EXISTS gender text CHECK (gender IN ('Male', 'Female', 'Prefer not to say')),
  ADD COLUMN IF NOT EXISTS discoverable boolean NOT NULL DEFAULT true;

-- New columns on communities
ALTER TABLE communities
  ADD COLUMN IF NOT EXISTS interest_tag text,
  ADD COLUMN IF NOT EXISTS is_open boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('pending', 'active'));

-- New columns on circle_requests
ALTER TABLE circle_requests
  ADD COLUMN IF NOT EXISTS interest_tag text,
  ADD COLUMN IF NOT EXISTS is_open boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS invitees uuid[] NOT NULL DEFAULT '{}';

-- New columns on notifications
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS category text CHECK (category IN ('Connections', 'Circles', 'Campus')),
  ADD COLUMN IF NOT EXISTS group_key text,
  ADD COLUMN IF NOT EXISTS group_count int NOT NULL DEFAULT 1;

-- 30. CONNECTIONS
CREATE TABLE IF NOT EXISTS connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  connected_user_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT connections_no_self CHECK (user_id <> connected_user_id),
  CONSTRAINT connections_unique_pair UNIQUE (user_id, connected_user_id)
);

CREATE INDEX IF NOT EXISTS idx_connections_user_id ON connections(user_id);
CREATE INDEX IF NOT EXISTS idx_connections_connected_user_id ON connections(connected_user_id);
CREATE INDEX IF NOT EXISTS idx_connections_status ON connections(status);

ALTER TABLE connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own connections" ON connections FOR SELECT TO authenticated USING (auth.uid() = user_id OR auth.uid() = connected_user_id);
CREATE POLICY "Users insert own requests" ON connections FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own received requests" ON connections FOR UPDATE TO authenticated USING (auth.uid() = connected_user_id OR auth.uid() = user_id);
CREATE POLICY "Users delete own connections" ON connections FOR DELETE TO authenticated USING (auth.uid() = user_id OR auth.uid() = connected_user_id);
CREATE POLICY "Service role full access connections" ON connections TO service_role USING (true) WITH CHECK (true);

-- 31. BLOCKS
CREATE TABLE IF NOT EXISTS blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT blocks_no_self CHECK (blocker_id <> blocked_id),
  CONSTRAINT blocks_unique_pair UNIQUE (blocker_id, blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_blocks_blocker_id ON blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocks_blocked_id ON blocks(blocked_id);

ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own blocks" ON blocks FOR SELECT TO authenticated USING (auth.uid() = blocker_id OR auth.uid() = blocked_id);
CREATE POLICY "Users insert own blocks" ON blocks FOR INSERT TO authenticated WITH CHECK (auth.uid() = blocker_id);
CREATE POLICY "Users delete own blocks" ON blocks FOR DELETE TO authenticated USING (auth.uid() = blocker_id);
CREATE POLICY "Service role full access blocks" ON blocks TO service_role USING (true) WITH CHECK (true);

-- 32. LOGIN_STREAKS
CREATE TABLE IF NOT EXISTS login_streaks (
  user_id uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  streak_count int NOT NULL DEFAULT 0,
  last_login_date date,
  longest_streak int NOT NULL DEFAULT 0
);

ALTER TABLE login_streaks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own streak" ON login_streaks FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Service role full access streaks" ON login_streaks TO service_role USING (true) WITH CHECK (true);

-- 33. NOTIFICATION_MUTES
CREATE TABLE IF NOT EXISTS notification_mutes (
  user_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('Connections', 'Circles', 'Campus')),
  PRIMARY KEY (user_id, category)
);

ALTER TABLE notification_mutes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own mutes" ON notification_mutes FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Service role full access mutes" ON notification_mutes TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- Total: 33 tables (4 new) + columns added to 4 existing tables
-- ============================================================
