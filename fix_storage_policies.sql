-- Fix storage bucket policies for chat-media
-- Run this in Supabase SQL Editor
-- This fixes "Tracking Prevention blocked access to storage" errors

-- Drop ALL existing policies for chat-media bucket
DROP POLICY IF EXISTS "Public can view chat media" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view chat media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload chat media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload to chat media" ON storage.objects;
DROP POLICY IF EXISTS "Service role can manage chat media" ON storage.objects;
DROP POLICY IF EXISTS "Service role full access to chat media" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own chat media" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own chat media" ON storage.objects;

-- 1. Public read access (anyone can view media)
CREATE POLICY "chat_media_public_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'chat-media');

-- 2. Authenticated upload (simplified - no folder restrictions)
CREATE POLICY "chat_media_authenticated_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'chat-media');

-- 3. Authenticated update
CREATE POLICY "chat_media_authenticated_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'chat-media')
  WITH CHECK (bucket_id = 'chat-media');

-- 4. Authenticated delete
CREATE POLICY "chat_media_authenticated_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'chat-media');

-- Ensure bucket is public and has correct settings
UPDATE storage.buckets 
SET 
  public = true,
  file_size_limit = 52428800,  -- 50MB
  allowed_mime_types = ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4', 'video/webm', 'video/quicktime',
    'audio/webm', 'audio/mpeg', 'audio/ogg', 'audio/wav'
  ]
WHERE id = 'chat-media';
