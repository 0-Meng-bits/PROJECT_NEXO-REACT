-- Fix storage policies to allow API uploads via service role
-- This allows the backend API to upload files on behalf of users

-- Drop existing policies
DROP POLICY IF EXISTS "Users can upload their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload to chat-media" ON storage.objects;
DROP POLICY IF EXISTS "Members can view chat media" ON storage.objects;

-- Avatars bucket: Allow authenticated users and service role to upload
CREATE POLICY "Allow avatar uploads"
ON storage.objects FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'avatars' 
  AND (
    auth.role() = 'authenticated'
    OR auth.role() = 'service_role'
  )
);

CREATE POLICY "Allow avatar updates"
ON storage.objects FOR UPDATE
TO public
USING (bucket_id = 'avatars')
WITH CHECK (
  bucket_id = 'avatars'
  AND (
    auth.role() = 'authenticated'
    OR auth.role() = 'service_role'
  )
);

CREATE POLICY "Anyone can view avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- Chat-media bucket: Allow authenticated users and service role
CREATE POLICY "Allow chat media uploads"
ON storage.objects FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'chat-media'
  AND (
    auth.role() = 'authenticated'
    OR auth.role() = 'service_role'
  )
);

CREATE POLICY "Allow chat media updates"
ON storage.objects FOR UPDATE
TO public
USING (bucket_id = 'chat-media')
WITH CHECK (
  bucket_id = 'chat-media'
  AND (
    auth.role() = 'authenticated'
    OR auth.role() = 'service_role'
  )
);

CREATE POLICY "Members can view chat media"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'chat-media');
