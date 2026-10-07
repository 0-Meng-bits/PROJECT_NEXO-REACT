CREATE TABLE IF NOT EXISTS comment_hearts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  comment_id uuid REFERENCES post_comments(id) ON DELETE CASCADE,
  user_id uuid REFERENCES accounts(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(comment_id, user_id)
);

ALTER TABLE comment_hearts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can heart comments" ON comment_hearts FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_comment_hearts_comment ON comment_hearts(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_hearts_user ON comment_hearts(user_id);
