-- Online presence: track last active timestamp on profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen timestamptz;

-- Message reads: track who has seen which message (for circle chat)
CREATE TABLE IF NOT EXISTS message_reads (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id  uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  reader_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  read_at     timestamptz DEFAULT now(),
  UNIQUE(message_id, reader_id)
);

ALTER TABLE message_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own reads"
  ON message_reads FOR INSERT
  WITH CHECK (auth.uid() = reader_id);

CREATE POLICY "Users can read all reads"
  ON message_reads FOR SELECT
  USING (true);
