-- Profile photo reactions (heart reacts)
CREATE TABLE IF NOT EXISTS profile_photo_reactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  photo_id uuid REFERENCES profile_photos(id) ON DELETE CASCADE,
  user_id uuid REFERENCES accounts(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(photo_id, user_id)
);

ALTER TABLE profile_photo_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can react" ON profile_photo_reactions FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_photo_reactions_photo ON profile_photo_reactions(photo_id);
CREATE INDEX IF NOT EXISTS idx_photo_reactions_user ON profile_photo_reactions(user_id);
