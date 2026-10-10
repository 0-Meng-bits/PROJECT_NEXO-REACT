-- ============================================================
-- NEXO Connect Features — Combined Migration
-- Run this once in Supabase SQL Editor
-- ============================================================

-- 1. account_details: add gender and discoverable
ALTER TABLE account_details
  ADD COLUMN IF NOT EXISTS gender text CHECK (gender IN ('Male', 'Female', 'Prefer not to say')),
  ADD COLUMN IF NOT EXISTS discoverable boolean NOT NULL DEFAULT true;

-- 2. communities: add interest_tag, is_open, status
ALTER TABLE communities
  ADD COLUMN IF NOT EXISTS interest_tag text,
  ADD COLUMN IF NOT EXISTS is_open boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('pending', 'active'));

-- 3. connections table
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

CREATE POLICY "Users read own connections" ON connections
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = connected_user_id);

CREATE POLICY "Users insert own requests" ON connections
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own received requests" ON connections
  FOR UPDATE TO authenticated
  USING (auth.uid() = connected_user_id OR auth.uid() = user_id);

CREATE POLICY "Users delete own connections" ON connections
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = connected_user_id);

CREATE POLICY "Service role full access connections" ON connections
  TO service_role USING (true) WITH CHECK (true);

-- 4. blocks table
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

CREATE POLICY "Users read own blocks" ON blocks
  FOR SELECT TO authenticated
  USING (auth.uid() = blocker_id OR auth.uid() = blocked_id);

CREATE POLICY "Users insert own blocks" ON blocks
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = blocker_id);

CREATE POLICY "Users delete own blocks" ON blocks
  FOR DELETE TO authenticated
  USING (auth.uid() = blocker_id);

CREATE POLICY "Service role full access blocks" ON blocks
  TO service_role USING (true) WITH CHECK (true);

-- 5. login_streaks table
CREATE TABLE IF NOT EXISTS login_streaks (
  user_id uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  streak_count int NOT NULL DEFAULT 0,
  last_login_date date,
  longest_streak int NOT NULL DEFAULT 0
);

ALTER TABLE login_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own streak" ON login_streaks
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access streaks" ON login_streaks
  TO service_role USING (true) WITH CHECK (true);

-- 6. notifications: add category, group_key, group_count
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS category text CHECK (category IN ('Connections', 'Circles', 'Campus')),
  ADD COLUMN IF NOT EXISTS group_key text,
  ADD COLUMN IF NOT EXISTS group_count int NOT NULL DEFAULT 1;

-- 7. notification_mutes table
CREATE TABLE IF NOT EXISTS notification_mutes (
  user_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('Connections', 'Circles', 'Campus')),
  PRIMARY KEY (user_id, category)
);

ALTER TABLE notification_mutes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own mutes" ON notification_mutes
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access mutes" ON notification_mutes
  TO service_role USING (true) WITH CHECK (true);

-- 8. circle_requests: add interest_tag, is_open, invitees
ALTER TABLE circle_requests
  ADD COLUMN IF NOT EXISTS interest_tag text,
  ADD COLUMN IF NOT EXISTS is_open boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS invitees uuid[] NOT NULL DEFAULT '{}';
