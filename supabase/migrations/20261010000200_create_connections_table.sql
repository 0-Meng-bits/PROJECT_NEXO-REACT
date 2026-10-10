-- Migration: Create connections table with indexes, constraints, and RLS
-- Requirements: 10.4, 10.6

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

-- RLS policies for connections
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
  TO service_role
  USING (true)
  WITH CHECK (true);
