-- Post likes (hearts) for announcements/posts in both Home Feed and Circle feeds
CREATE TABLE IF NOT EXISTS post_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT post_likes_unique UNIQUE (announcement_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_post_likes_announcement_id ON post_likes(announcement_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_user_id ON post_likes(user_id);

-- RLS
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read post likes" ON post_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users manage own likes" ON post_likes FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Service role full access post_likes" ON post_likes TO service_role USING (true) WITH CHECK (true);
