-- Migration: Create login_streaks table with RLS
-- Requirements: 10.3

CREATE TABLE IF NOT EXISTS login_streaks (
  user_id uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  streak_count int NOT NULL DEFAULT 0,
  last_login_date date,
  longest_streak int NOT NULL DEFAULT 0
);

-- RLS policies for login_streaks
ALTER TABLE login_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own streak" ON login_streaks
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access streaks" ON login_streaks
  TO service_role
  USING (true)
  WITH CHECK (true);
