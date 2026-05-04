-- ============================================================
-- RLS: Circle Isolation
-- Channels, messages, and announcements are exclusive to their
-- circle members. Admins can see everything.
-- ============================================================

-- Enable RLS on all relevant tables
ALTER TABLE channels      ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- ── Helper: check if user is an admin ────────────────────────────────────────
CREATE OR REPLACE FUNCTION is_admin(uid uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = uid AND user_type = 'Admin'
  );
$$;

-- ── Helper: check if user is a member of a community ─────────────────────────
CREATE OR REPLACE FUNCTION is_circle_member(uid uuid, comm_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM memberships
    WHERE user_id = uid
      AND community_id = comm_id
      AND status = 'active'
  ) OR EXISTS (
    -- Circle creator is always a member
    SELECT 1 FROM communities
    WHERE id = comm_id AND creator_id = uid
  );
$$;

-- ── CHANNELS ──────────────────────────────────────────────────────────────────
-- Users can only see channels that belong to circles they are members of
-- Admins can see all channels

DROP POLICY IF EXISTS "channels_select" ON channels;
CREATE POLICY "channels_select" ON channels
  FOR SELECT USING (
    is_admin(auth.uid())
    OR is_circle_member(auth.uid(), community_id)
  );

DROP POLICY IF EXISTS "channels_insert" ON channels;
CREATE POLICY "channels_insert" ON channels
  FOR INSERT WITH CHECK (
    is_circle_member(auth.uid(), community_id)
  );

DROP POLICY IF EXISTS "channels_delete" ON channels;
CREATE POLICY "channels_delete" ON channels
  FOR DELETE USING (
    is_admin(auth.uid())
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM communities WHERE id = community_id AND creator_id = auth.uid()
    )
  );

-- ── MESSAGES ─────────────────────────────────────────────────────────────────
-- Global messages (community_id IS NULL) are visible to all verified users
-- Circle messages are only visible to members of that circle
-- Admins can see all messages

DROP POLICY IF EXISTS "messages_select" ON messages;
CREATE POLICY "messages_select" ON messages
  FOR SELECT USING (
    is_admin(auth.uid())
    OR community_id IS NULL  -- global feed
    OR is_circle_member(auth.uid(), community_id)
  );

DROP POLICY IF EXISTS "messages_insert" ON messages;
CREATE POLICY "messages_insert" ON messages
  FOR INSERT WITH CHECK (
    community_id IS NULL  -- global feed — any verified user
    OR is_circle_member(auth.uid(), community_id)
  );

DROP POLICY IF EXISTS "messages_update" ON messages;
CREATE POLICY "messages_update" ON messages
  FOR UPDATE USING (
    student_id = (SELECT student_id FROM profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "messages_delete" ON messages;
CREATE POLICY "messages_delete" ON messages
  FOR DELETE USING (
    is_admin(auth.uid())
    OR student_id = (SELECT student_id FROM profiles WHERE id = auth.uid())
  );

-- ── ANNOUNCEMENTS ─────────────────────────────────────────────────────────────
-- Campus-wide announcements (community_id IS NULL) are visible to all
-- Circle announcements are only visible to members of that circle
-- Admins can see all announcements

DROP POLICY IF EXISTS "announcements_select" ON announcements;
CREATE POLICY "announcements_select" ON announcements
  FOR SELECT USING (
    is_admin(auth.uid())
    OR community_id IS NULL  -- campus-wide feed
    OR is_circle_member(auth.uid(), community_id)
  );

DROP POLICY IF EXISTS "announcements_insert" ON announcements;
CREATE POLICY "announcements_insert" ON announcements
  FOR INSERT WITH CHECK (
    community_id IS NULL  -- campus feed — any verified user
    OR is_circle_member(auth.uid(), community_id)
  );

DROP POLICY IF EXISTS "announcements_update" ON announcements;
CREATE POLICY "announcements_update" ON announcements
  FOR UPDATE USING (
    is_admin(auth.uid())
    OR author_id = auth.uid()
  );

DROP POLICY IF EXISTS "announcements_delete" ON announcements;
CREATE POLICY "announcements_delete" ON announcements
  FOR DELETE USING (
    is_admin(auth.uid())
    OR author_id = auth.uid()
  );
