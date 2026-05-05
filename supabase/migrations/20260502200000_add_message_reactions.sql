-- Message reactions table
CREATE TABLE IF NOT EXISTS message_reactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id uuid REFERENCES messages(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  student_id text,
  reaction text NOT NULL CHECK (reaction IN ('heart', 'laugh', 'sad')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(message_id, user_id, reaction)
);

CREATE INDEX IF NOT EXISTS idx_reactions_message_id ON message_reactions(message_id);

-- Allow anyone to read reactions
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read reactions" ON message_reactions;
CREATE POLICY "Anyone can read reactions" ON message_reactions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can manage own reactions" ON message_reactions;
CREATE POLICY "Users can manage own reactions" ON message_reactions FOR ALL USING (true);
