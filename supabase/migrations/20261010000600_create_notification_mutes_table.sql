-- Migration: Create notification_mutes table with RLS
-- Requirements: 10.5

CREATE TABLE IF NOT EXISTS notification_mutes (
  user_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('Connections', 'Circles', 'Campus')),
  PRIMARY KEY (user_id, category)
);

-- RLS policies for notification_mutes
ALTER TABLE notification_mutes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own mutes" ON notification_mutes
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access mutes" ON notification_mutes
  TO service_role
  USING (true)
  WITH CHECK (true);
