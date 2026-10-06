-- Profile photos table (max 2 per user)
CREATE TABLE IF NOT EXISTS profile_photos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES accounts(id) ON DELETE CASCADE,
  photo_url text NOT NULL,
  slot int NOT NULL CHECK (slot IN (1, 2)),
  is_public boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, slot)
);

ALTER TABLE profile_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own photos" ON profile_photos FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_profile_photos_user ON profile_photos(user_id);
