-- Enable RLS and add policies for post_comments
ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;

-- Anyone can read comments
DROP POLICY IF EXISTS "Anyone can read post_comments" ON post_comments;
CREATE POLICY "Anyone can read post_comments"
  ON post_comments FOR SELECT USING (true);

-- Authenticated users can insert their own comments
DROP POLICY IF EXISTS "Users can insert own post_comments" ON post_comments;
CREATE POLICY "Users can insert own post_comments"
  ON post_comments FOR INSERT
  WITH CHECK (auth.uid() = author_id);

-- Users can delete their own comments
DROP POLICY IF EXISTS "Users can delete own post_comments" ON post_comments;
CREATE POLICY "Users can delete own post_comments"
  ON post_comments FOR DELETE
  USING (auth.uid() = author_id);
