-- ── ADD ID VERIFICATION FIELDS ─────────────────────────────────────────────
-- Adds the missing id_verified column to profiles and creates the id-photos
-- storage bucket so school ID photos can be uploaded and displayed.

-- 1. Add id_verified column to profiles (was being saved by signup API but
--    never existed in the schema, so it was silently dropped every time)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS id_verified boolean DEFAULT false;

-- 2. Create the id-photos storage bucket (public so the admin can view photos)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'id-photos',
  'id-photos',
  true,
  5242880,  -- 5 MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage policy: allow service role (used by signup API) to upload
CREATE POLICY "Service role can upload id photos"
  ON storage.objects FOR INSERT
  TO service_role
  WITH CHECK (bucket_id = 'id-photos');

-- 4. Storage policy: allow public read so admin can view the photos
CREATE POLICY "Public can view id photos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'id-photos');

-- 5. Backfill: mark existing users who have a photo as id_verified = false
--    (they submitted a photo but the column didn't exist, so we default to
--    false meaning admin must manually review them — which is correct)
UPDATE profiles
SET id_verified = false
WHERE id_photo_url IS NOT NULL AND id_verified IS NULL;
