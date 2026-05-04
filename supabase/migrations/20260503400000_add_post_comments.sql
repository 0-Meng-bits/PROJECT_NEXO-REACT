-- Comments on announcements/posts
CREATE TABLE IF NOT EXISTS post_comments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  announcement_id uuid REFERENCES announcements(id) ON DELETE CASCADE,
  author_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  author_name text NOT NULL,
  author_type text,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);
