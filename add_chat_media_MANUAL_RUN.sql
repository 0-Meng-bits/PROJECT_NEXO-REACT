-- ============================================================
-- ADD CHAT MEDIA SUPPORT - MANUAL RUN
-- Date: 2026-08-31
-- Instructions: Copy this entire file and run it in Supabase SQL Editor
-- ============================================================

-- 1. Add media columns to messages table
ALTER TABLE messages 
  ADD COLUMN IF NOT EXISTS message_type text DEFAULT 'text' 
    CHECK (message_type IN ('text', 'image', 'video', 'voice')),
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS media_size bigint,
  ADD COLUMN IF NOT EXISTS media_duration int;

-- 2. Create chat-media storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-media',
  'chat-media',
  true,
  52428800,  -- 50 MB limit
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4', 'video/webm', 'video/quicktime',
    'audio/webm', 'audio/mpeg', 'audio/ogg', 'audio/wav'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage policies for chat-media bucket

-- Allow public read access (so everyone can view shared media)
DROP POLICY IF EXISTS "Public can view chat media" ON storage.objects;
CREATE POLICY "Public can view chat media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'chat-media');

-- Allow authenticated users to upload media
DROP POLICY IF EXISTS "Authenticated users can upload chat media" ON storage.objects;
CREATE POLICY "Authenticated users can upload chat media"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'chat-media');

-- Allow service role full access
DROP POLICY IF EXISTS "Service role can manage chat media" ON storage.objects;
CREATE POLICY "Service role can manage chat media"
  ON storage.objects
  TO service_role
  USING (bucket_id = 'chat-media')
  WITH CHECK (bucket_id = 'chat-media');

-- Allow users to delete their own media
DROP POLICY IF EXISTS "Users can delete own chat media" ON storage.objects;
CREATE POLICY "Users can delete own chat media"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'chat-media' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================================
-- DONE! Verify by checking:
-- 1. Run: SELECT column_name FROM information_schema.columns WHERE table_name = 'messages';
-- 2. Check Storage settings to see 'chat-media' bucket
-- ============================================================
