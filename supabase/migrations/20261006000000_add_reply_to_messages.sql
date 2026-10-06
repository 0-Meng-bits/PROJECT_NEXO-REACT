-- Add reply_to_id to messages for threaded replies
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES messages(id) ON DELETE SET NULL;

-- Also store a snapshot of the replied-to content so we don't need a join every time
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS reply_to_preview text;

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS reply_to_author text;

CREATE INDEX IF NOT EXISTS idx_messages_reply_to ON messages(reply_to_id) WHERE reply_to_id IS NOT NULL;
